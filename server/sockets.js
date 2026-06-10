const pool = require('./db');
const BotService = require('./bot-service');
const sanitizeHtml = require('sanitize-html');
const notificationService = require('./notification-service');
const waService = require('./whatsappService');
const {
    buildEffectiveManagerIdSql,
    getPropertyAccessScope,
    propertyIsManagedByScope
} = require('./property-access');

const EFFECTIVE_MANAGER_SQL = buildEffectiveManagerIdSql('p');

// --- Rate Limiting for Sockets ---
const clientEventTracker = new Map();

function checkRateLimit(socketId, eventName, limit, timeframe) {
    const now = Date.now();
    const clientRecord = clientEventTracker.get(socketId) || {};
    
    const eventTimestamps = clientRecord[eventName] || [];
    const recentTimestamps = eventTimestamps.filter(ts => now - ts < timeframe);

    if (recentTimestamps.length >= limit) {
        return true; // Limit exceeded
    }

    recentTimestamps.push(now);
    clientRecord[eventName] = recentTimestamps;
    clientEventTracker.set(socketId, clientRecord);

    return false;
}

const waMessageThrottle = new Map();

module.exports = function setupSockets(io) {
    // --- Server-side authentication middleware ---
    // Runs ONCE per new socket connection. Reads the Express session that was
    // already parsed by io.engine.use(sessionMiddleware) in server.js and
    // attaches the verified user identity to the socket object.
    // Guest (unauthenticated) connections are still allowed so they can view
    // property pages; they simply won't be placed in a private user room.
    io.use((socket, next) => {
        const session = socket.request.session;
        if (session && session.user && session.user.id) {
            socket.userId   = session.user.id;
            socket.userRole = session.user.role;
            socket.username = session.user.username;
        }
        next(); // Always allow the connection
    });

    const onlineUsers = new Set();

    io.on('connection', (socket) => {
        if (socket.userId) {
            onlineUsers.add(socket.userId);
            io.emit('user_status', { userId: socket.userId, status: 'online' });
        }
        
        io.emit('online_users_count', io.engine.clientsCount);

        // Auto-join the authenticated user to their private notification room.
        if (socket.userId) {
            socket.join(`user_${socket.userId}`);
        }

        socket.on('disconnect', () => {
            if (socket.userId) {
                onlineUsers.delete(socket.userId);
                io.emit('user_status', { userId: socket.userId, status: 'offline' });
            }
            clientEventTracker.delete(socket.id); // Clean up rate limit tracking on disconnect
            io.emit('online_users_count', io.engine.clientsCount);
        });
        
        socket.on('join_room', async (data) => {
            if (typeof data === 'object' && data.conversationId) {
                const convId = data.conversationId;
                socket.join(`conv_${convId}`);
                
                // When joining a conversation room, check if the other person is online
                try {
                    const convRes = await pool.query(
                        `SELECT pc.buyer_id, ${EFFECTIVE_MANAGER_SQL} AS effective_manager_id
                         FROM property_conversations pc
                         JOIN properties p ON p.id = pc.property_id
                         WHERE pc.id = $1`,
                        [convId]
                    );
                    if (convRes.rows.length > 0) {
                        const { buyer_id, effective_manager_id } = convRes.rows[0];
                        const otherUserId = socket.userId === buyer_id ? effective_manager_id : buyer_id;
                        socket.emit('user_status', { 
                            userId: otherUserId, 
                            status: onlineUsers.has(otherUserId) ? 'online' : 'offline' 
                        });
                    }
                } catch (e) { console.error('Join room status error:', e); }
                return;
            }

            const propId = typeof data === 'object' ? data.propertyId : data;
            const username = typeof data === 'object' ? data.username : null;
            socket.join(`property_${propId}`);

            if (username) {
                try {
                    // Fetch user ID and role
                    const userRes = await pool.query('SELECT id, role FROM users WHERE username = $1', [username]);
                    if (userRes.rows.length > 0) {
                        const { id: userId, role } = userRes.rows[0];
                        const propRes = await pool.query('SELECT owner_id, assigned_broker_id FROM properties WHERE id = $1', [propId]);
                        const isOwner = propRes.rows.length > 0 && propRes.rows[0].owner_id === userId;
                        const isBroker = propRes.rows.length > 0 && propRes.rows[0].assigned_broker_id === userId;

                        if (['admin', 'support'].includes(role) || isOwner || isBroker) {
                            socket.join(`property_${propId}_management`);
                            // Join all buyer rooms for this property
                            const buyerRows = await pool.query('SELECT buyer_id FROM property_conversations WHERE property_id = $1', [propId]);
                            buyerRows.rows.forEach(row => socket.join(`property_${propId}_buyer_${row.buyer_id}`));
                        } else {
                            // Private buyer room
                            socket.join(`property_${propId}_buyer_${userId}`);
                        }
                    }
                    await BotService.sendWelcome(io, propId, username);
                } catch (err) { console.error("Join room bot welcome error:", err); }
            }
        });
        
        socket.on('send_message', async (data) => {
            // Rate limit: 10 messages per 10 seconds
            if (checkRateLimit(socket.id, 'send_message', 10, 10000)) {
                console.warn(`[Socket Rate Limit] Dropped 'send_message' from ${socket.id}`);
                return;
            }

            // 1. Sanitize text content to prevent XSS
            if (data.content) {
                data.content = sanitizeHtml(data.content, {
                    allowedTags: [], // Strip all HTML tags, strictly plain text
                    allowedAttributes: {}
                });
            }

            // 2. Prevent DoS from oversized audio base64 payloads (Limit to ~1.5MB)
            if (data.audio && data.audio.data) {
                if (data.audio.data.length > 2000000) {
                    console.warn(`[Socket] Dropped oversized audio payload from ${data.sender}`);
                    return; // Drop the message entirely
                }
            }

            // 3. Drop empty messages (e.g., if the user only sent a malicious <script> tag that got stripped)
            if (!data.content && !data.audio) return;

            // Determine sender's role and tenantUsername
            const senderName = data.sender || socket.username;
            if (!senderName && data.sender !== 'Saksh') {
                console.error("[Socket] Unauthorized message attempt: No sender identity");
                return;
            }

            let tenantUsername = data.tenantUsername; 
            let senderRole = 'tenant';

            if (senderName === 'Saksh') {
                senderRole = 'bot';
            } else {
                const roleRes = await pool.query('SELECT role FROM users WHERE username = $1', [senderName]);
                if (roleRes.rows.length > 0) senderRole = roleRes.rows[0].role;
            }

            if (!tenantUsername) {
                tenantUsername = senderName;
            }
            data.tenantUsername = tenantUsername;
            data.sender = senderName;

            let tenantId = data.tenantId;
            if (data.conversationId && !data.propertyId) {
                const convLookup = await pool.query('SELECT property_id, buyer_id FROM property_conversations WHERE id = $1::int', [data.conversationId]);
                if (convLookup.rows.length > 0) {
                    data.propertyId = convLookup.rows[0].property_id;
                    tenantId = convLookup.rows[0].buyer_id;
                }
            }

            if (!tenantId && tenantUsername) {
                const tRes = await pool.query('SELECT id FROM users WHERE username = $1', [tenantUsername]);
                tenantId = tRes.rows[0]?.id;
            }
            if (!tenantId) {
                console.error("[Socket] Could not resolve tenant ID for:", tenantUsername);
                return;
            }

            // Determine who gets to see this message
            let visibility = 'private';
            
            if (data.sender === 'Saksh') {
                visibility = 'bot'; // Admin can see bot replies
            } else if (data.content.includes('@admin') || data.content.includes('@support')) {
                visibility = 'escalated'; // User explicitly requested management
            } else if (['admin', 'support'].includes(senderRole)) {
                visibility = 'management';
            }

            const isTenant = socket.userId === tenantId;
            let conversationId = null;

            try {
                const propertyRes = await pool.query(
                    'SELECT owner_id, assigned_broker_id, assigned_brokers FROM properties WHERE id = $1::int',
                    [data.propertyId]
                );
                const property = propertyRes.rows[0];
                if (!property) {
                    console.error("[Socket] Property missing for message:", data.propertyId);
                    return;
                }
                const senderScope = await getPropertyAccessScope({ id: socket.userId, role: socket.userRole });
                const senderIsManagement = !isTenant && propertyIsManagedByScope(property, senderScope);

                // Insert or fetch conversation using property_conversations
                const convRes = await pool.query(`
                    INSERT INTO property_conversations (property_id, buyer_id, owner_id, last_message, last_message_at, 
                        unread_count_owner, unread_count_buyer)
                    SELECT $1::int, $2::int, ${EFFECTIVE_MANAGER_SQL}, $3, NOW(),
                           (CASE WHEN $5::boolean THEN 0 ELSE 1 END),
                           (CASE WHEN $6::boolean THEN 0 ELSE 1 END)
                    FROM properties p WHERE p.id = $1::int
                    ON CONFLICT (property_id, buyer_id, owner_id) 
                    DO UPDATE SET 
                        last_message = EXCLUDED.last_message, 
                        last_message_at = EXCLUDED.last_message_at,
                        unread_count_owner = property_conversations.unread_count_owner + (CASE WHEN $5::boolean THEN 0 ELSE 1 END),
                        unread_count_buyer = property_conversations.unread_count_buyer + (CASE WHEN $6::boolean THEN 0 ELSE 1 END)
                    RETURNING id, owner_id, buyer_id`
                , [data.propertyId, tenantId, data.content, socket.userId, senderIsManagement, isTenant]);
                if (convRes.rowCount === 0) {
                    console.error("[Socket] Failed to create/find conversation for property:", data.propertyId);
                    return;
                }
                conversationId = convRes.rows[0].id;
                // Insert the message into chat_messages and echo the persisted shape to clients.
                const msgRes = await pool.query(
                    'INSERT INTO chat_messages (conversation_id, sender_id, content, visibility) VALUES ($1::int, $2::int, $3, $4) RETURNING id, conversation_id, sender_id, content, created_at, is_read',
                    [conversationId, socket.userId, data.content, visibility]
                );
                Object.assign(data, msgRes.rows[0]);
                data.conversationId = conversationId;
            } catch (dbErr) {
                console.error("[Socket] Failed to insert message:", dbErr.message);
                return; // Drop the message if DB constraint fails
            }
            
            // Notification Logic
            try {
                const propRes = await pool.query('SELECT owner_id, assigned_broker_id, title FROM properties WHERE id = $1', [data.propertyId]);
                const property = propRes.rows[0];
                const senderRes = await pool.query('SELECT id FROM users WHERE username = $1', [data.sender]);
                const senderId = senderRes.rows[0]?.id;

                if (property && senderId) {
                    const notifiedUsers = new Set();
                    notifiedUsers.add(senderId); // Don't notify self

                    const sendNotif = async (userId, content) => {
                        if (!userId || notifiedUsers.has(userId)) return;
                        notifiedUsers.add(userId);
                        const link = `/property/${data.propertyId}`;
                        await notificationService.sendNotification(userId, content, link);

                    // Trigger WhatsApp Notification (Throttled to once every 15 mins per user to prevent spam)
                    const now = Date.now();
                    const throttleKey = `wa_msg_${userId}`;
                    const lastSent = waMessageThrottle.get(throttleKey) || 0;
                    
                    if (now - lastSent > 15 * 60 * 1000) {
                        waMessageThrottle.set(throttleKey, now);
                        try {
                            const uRes = await pool.query('SELECT name, username, phone FROM users WHERE id = $1', [userId]);
                            if (uRes.rows.length > 0 && uRes.rows[0].phone) {
                                const uInfo = uRes.rows[0];
                                const displayName = uInfo.name || uInfo.username || 'User';
                                waService.sendMessageNotification(uInfo.phone, displayName, data.propertyId).catch(e => console.error('WA Error:', e));
                            }
                        } catch (err) { console.error('WA Notification Error:', err); }
                    }
                    };

                    await sendNotif(property.owner_id, `New message on "${property.title}"`);
                    if (property.assigned_broker_id) {
                        await sendNotif(property.assigned_broker_id, `New message on "${property.title}"`);
                    }

                    // Notify other participants (if any)
                    const participants = await pool.query(
                        'SELECT DISTINCT sender_id as id FROM chat_messages WHERE conversation_id = $1', 
                        [conversationId]
                    );
                    for (let p of participants.rows) { await sendNotif(p.id, `New message on "${property.title}"`); }
                }
            } catch (e) { console.error("Notification error:", e); }

            // Isolate chat delivery to the specific tenant and management
            data.conversationId = conversationId;
            data.senderId = socket.userId;
            data.timestamp = new Date().toISOString();
            
            // Emit to conversation room
            io.to(`conv_${conversationId}`).emit('receive_message', data);

            // Legacy support for property rooms
            io.to(`property_${data.propertyId}_${tenantUsername}`)
              .to(`property_${data.propertyId}_management`)
              .emit('receive_message', data);

            // --- Saksh Bot Logic ---
            BotService.processMessage(io, data);
        });

        socket.on('typing', (data) => {
            if (checkRateLimit(socket.id, 'typing', 20, 10000)) return;
            if (data.conversationId) {
                socket.to(`conv_${data.conversationId}`).emit('typing', { conversationId: data.conversationId, userId: socket.userId });
            } else {
                let room = `property_${data.propertyId}`;
                if (data.tenantUsername) room = `property_${data.propertyId}_${data.tenantUsername}`;
                socket.to(room).to(`property_${data.propertyId}_management`).emit('typing', data);
            }
        });

        socket.on('stop_typing', (data) => {
            if (checkRateLimit(socket.id, 'stop_typing', 20, 10000)) return;
            if (data.conversationId) {
                socket.to(`conv_${data.conversationId}`).emit('stop_typing', { conversationId: data.conversationId, userId: socket.userId });
            } else {
                let room = `property_${data.propertyId}`;
                if (data.tenantUsername) room = `property_${data.propertyId}_${data.tenantUsername}`;
                socket.to(room).to(`property_${data.propertyId}_management`).emit('stop_typing', data);
            }
        });

        socket.on('mark_read', async (data) => {
            const { conversationId } = data;
            if (conversationId && socket.userId) {
                try {
                    const convRes = await pool.query(
                        `SELECT pc.buyer_id, p.owner_id, p.assigned_broker_id, p.assigned_brokers
                         FROM property_conversations pc
                         JOIN properties p ON p.id = pc.property_id
                         WHERE pc.id = $1`,
                        [conversationId]
                    );
                    if (convRes.rows.length === 0) return;

                    const conversation = convRes.rows[0];
                    const senderScope = await getPropertyAccessScope({ id: socket.userId, role: socket.userRole });
                    const isBuyer = Number(conversation.buyer_id) === Number(socket.userId);
                    const isManagement = !isBuyer && propertyIsManagedByScope(conversation, senderScope);
                    if (!isBuyer && !isManagement) return;

                    await pool.query(`
                        UPDATE property_conversations
                        SET unread_count_owner = CASE WHEN $1::boolean THEN 0 ELSE unread_count_owner END,
                            unread_count_buyer = CASE WHEN $2::boolean THEN 0 ELSE unread_count_buyer END
                        WHERE id = $3
                    `, [isManagement || senderScope.canModerateConversations, isBuyer, conversationId]);
                    
                    // Broadcast read status to the other person
                    socket.to(`conv_${conversationId}`).emit('message_read', { conversationId, readerId: socket.userId });
                } catch (e) { console.error('Mark read error:', e); }
            }
        });
    });
};
