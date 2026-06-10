const pool = require('./db');

async function verifyBotSchema() {
    const exists = await pool.query(`
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bot_responses'
        LIMIT 1
    `);

    if (exists.rowCount === 0) {
        throw new Error('Missing required table: bot_responses. Run database migrations before starting or seeding the backend.');
    }
}

const BotService = {
    // Backward-compatible schema check. Schema ownership now lives in migrations.
    async ensureSchema() {
        await verifyBotSchema();
    },

    // Seed default Saksh bot responses
    async seedDefaults() {
        try {
            await verifyBotSchema();
            // Seed default bot responses if empty
            const botCheck = await pool.query("SELECT count(*) FROM bot_responses");
            if (parseInt(botCheck.rows[0].count) === 0) {
                await pool.query("INSERT INTO bot_responses (trigger_text, response_text) VALUES ($1, $2), ($3, $4), ($5, $6), ($7, $8), ($9, $10), ($11, $12), ($13, $14), ($15, $16), ($17, $18), ($19, $20), ($21, $22)", [
                    "hello", "Hello! I am Saksh, your MatrixSpaces assistant. How can I help you with {{title}}?",
                    "price", "The estimated monthly rent for this property is ₹{{price}}.",
                    "location", "This property is located in {{locality}}.",
                    "DEFAULT_AWAY", "I am Saksh. I can help with price, location, size, or scheduling a visit. How can I help you with {{title}}?",
                    "WELCOME_AWAY", "Welcome to the chat! I am Saksh. I can help you with price, location, size, or scheduling a visit. How can I assist you with {{title}} today?",
                    "contact, phone, email", "You can reach out to us at {{user_phone}} or {{user_email}}.",
                    "size, area", "The property covers an area of {{size}}.",
                    "visit, tour, schedule", "You can schedule a visit using the 'Schedule Visit' button on the property page.",
                    "thanks, thank you", "You're welcome! Feel free to ask if you have more questions.",
                    "negotiable, offer", "The listed price is ₹{{price}}. You can chat with the owner to discuss this further.",
                    "manager, broker, owner, agent", "This property is managed by {{manager_name}}. You can contact them directly at {{manager_phone}} or {{manager_email}}."
                ]);
                console.log("Saksh Bot seeded with default responses.");
            } else {
                // Ensure welcome message is updated to include capabilities
                await pool.query("UPDATE bot_responses SET response_text = $1 WHERE trigger_text = 'WELCOME_AWAY'", [
                    "Welcome to the chat! I am Saksh. I can help you with price, location, size, or scheduling a visit. How can I assist you with {{title}} today?"
                ]);
            }
        } catch (e) {
            console.error("Bot seed error:", e.message);
        }
    },

    // Backwards-compatible combined initializer
    async initialize() {
        await this.ensureSchema();
        await this.seedDefaults();
    },

    // Handle Incoming Messages
    async processMessage(io, data) {
        // Ignore messages sent by the bot itself
        if (data.sender === 'Saksh') return;

        let user;

        try {
            // Check sender existence
            const userCheck = await pool.query("SELECT * FROM users WHERE username = $1", [data.sender]);
            if (userCheck.rows.length === 0) {
                console.log(`[Bot] User '${data.sender}' not found.`);
                return;
            }
            
            user = userCheck.rows[0];
            // Stop Saksh from replying to management when they intervene in a tenant's thread
            if (user.role !== 'tenant' && data.tenantUsername && data.tenantUsername !== data.sender) {
                console.log(`[Bot] Ignoring management intervention by ${data.sender}`);
                return;
            }
        } catch (e) { console.error("Bot role check error:", e); return; }

        try {
            const propRes = await pool.query(`
                SELECT p.*, 
                       COALESCE(b.name, b.username) as broker_name, b.phone as broker_phone, b.email as broker_email,
                       COALESCE(o.name, o.username) as owner_name, o.phone as owner_phone, o.email as owner_email
                FROM properties p
                LEFT JOIN users b ON p.assigned_broker_id = b.id
                LEFT JOIN users o ON p.owner_id = o.id
                WHERE p.id = $1
            `, [data.propertyId]);
            const property = propRes.rows[0];

            if (!property) {
                console.log(`[Bot] Property ${data.propertyId} not found.`);
                return;
            }
            
            const tenantUsername = data.tenantUsername || data.sender;

            // Fetch conversation history using the new schema
            let history = [];
            let tenantId;
            try {
                const tenantRes = await pool.query('SELECT id FROM users WHERE username = $1', [tenantUsername]);
                tenantId = tenantRes.rows[0]?.id;
                
                if (tenantId) {
                    const convCheck = await pool.query(
                        `SELECT bot_enabled FROM property_conversations 
                         WHERE property_id = $1::int AND buyer_id = $2::int`,
                        [data.propertyId, tenantId]
                    );
                    if (convCheck.rows.length > 0 && convCheck.rows[0].bot_enabled === false) {
                        console.log(`[Bot] Disabled for this conversation.`);
                        return;
                    }

                    const historyRes = await pool.query(
                        `SELECT cm.sender_id, cm.content, u.username as sender_username 
                         FROM chat_messages cm
                         JOIN property_conversations pc ON cm.conversation_id = pc.id
                         JOIN users u ON cm.sender_id = u.id
                         WHERE pc.property_id = $1::int AND pc.buyer_id = $2::int 
                         ORDER BY cm.created_at DESC LIMIT 10`,
                        [data.propertyId, tenantId]
                    );
                    history = historyRes.rows.reverse();
                }

            // Check if management (owner/admin/support) has intervened in the conversation recently
            const managementActive = history.some(msg => msg.sender_username !== tenantUsername && msg.sender_username !== 'Saksh');
            if (managementActive && data.sender === tenantUsername) {
                console.log(`[Bot] Management has taken over the chat for ${tenantUsername}. Saksh stays silent.`);
                return;
            }

            // Notify that Saksh is typing
            io.to(`property_${data.propertyId}_${tenantUsername}`).to(`property_${data.propertyId}_management`).emit('typing', { sender: 'Saksh', propertyId: data.propertyId, tenantUsername });

                // Remove the current message from history if it exists (since it was just inserted)
                if (history.length > 0) {
                    const lastMsg = history[history.length - 1];
                    if (lastMsg.content === data.content && lastMsg.sender_username === data.sender) {
                        history.pop();
                    }
                }
            } catch (e) { console.error("History fetch error:", e); }

            let reply = null;

            // 1. Keyword Matching
            const responses = await pool.query("SELECT * FROM bot_responses");
            const lowerContent = data.content.toLowerCase();

            // Find matching trigger
            for (let r of responses.rows) {
                if (r.trigger_text === 'DEFAULT_AWAY') continue;

                const triggers = r.trigger_text.toLowerCase().split(',').map(t => t.trim()).filter(t => t.length > 0);

                if (triggers.some(t => {
                    const escapedTrigger = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    return new RegExp(`\\b${escapedTrigger}\\b`).test(lowerContent);
                })) {
                    reply = r.response_text;
                    console.log(`[Bot] Trigger matched: "${r.trigger_text}"`);
                    break; 
                }
            }

            // Fallback Default
            if (!reply) {
                const awayRes = await pool.query("SELECT response_text FROM bot_responses WHERE trigger_text = 'DEFAULT_AWAY' LIMIT 1");
                if (awayRes.rows.length > 0) {
                    reply = awayRes.rows[0].response_text;
                }
            }

            // Process templates for keyword replies
            if (reply) {
                reply = this.processTemplate(reply, user, property);
            }

            // 2. Send Reply
            if (reply) {
                // Add a small delay for keyword responses to feel natural
                const delay = 1000;

                setTimeout(async () => {
                    try {
                        const sakshRes = await pool.query("SELECT id FROM users WHERE username = 'Saksh'");
                        const sakshId = sakshRes.rows[0]?.id;

                        // Insert or fetch conversation using property_conversations
                        const convRes = await pool.query(`
                            INSERT INTO property_conversations (property_id, buyer_id, owner_id, last_message, last_message_at, unread_count_buyer)
                            SELECT $1::int, $2::int, p.owner_id, $3, NOW(), 1
                            FROM properties p WHERE p.id = $1::int
                            ON CONFLICT (property_id, buyer_id, owner_id) 
                            DO UPDATE SET last_message = EXCLUDED.last_message, last_message_at = EXCLUDED.last_message_at, unread_count_buyer = property_conversations.unread_count_buyer + 1
                            RETURNING id`
                        , [data.propertyId, tenantId, reply]);
                        
                        if (convRes.rowCount === 0) {
                            console.error("[Bot] Failed to create/find conversation for property:", data.propertyId);
                            return;
                        }
                        const conversationId = convRes.rows[0].id;

                        // Save bot message to database
                        await pool.query('INSERT INTO chat_messages (conversation_id, sender_id, content, visibility) VALUES ($1::int, $2::int, $3, $4)',
                            [conversationId, sakshId, reply, 'bot']);

                        const payload = {
                            propertyId: data.propertyId,
                            sender: 'Saksh',
                            content: reply,
                            tenantUsername: tenantUsername,
                            conversationId: conversationId
                        };

                        // Emit bot message to chat
                        io.to(`property_${data.propertyId}_${tenantUsername}`).to(`property_${data.propertyId}_management`).emit('receive_message', payload);
                        io.to(`property_${data.propertyId}_${tenantUsername}`).to(`property_${data.propertyId}_management`).emit('stop_typing', { sender: 'Saksh', propertyId: data.propertyId, tenantUsername });
                    } catch (e) { console.error("Bot reply send error:", e); }
                }, delay);
            } else {
                io.to(`property_${data.propertyId}_${tenantUsername}`).to(`property_${data.propertyId}_management`).emit('stop_typing', { sender: 'Saksh', propertyId: data.propertyId, tenantUsername });
            }
        } catch (err) {
            console.error("Saksh Bot error:", err);
            const fallbackUser = data.tenantUsername || data.sender;
            io.to(`property_${data.propertyId}_${fallbackUser}`).to(`property_${data.propertyId}_management`).emit('stop_typing', { sender: 'Saksh', propertyId: data.propertyId, tenantUsername: fallbackUser });
        }
    },

    // Helper: Process Template Variables
    processTemplate(text, user, property) {
        const managerName = property.broker_name || property.owner_name || 'the manager';
        const managerPhone = property.broker_phone || property.owner_phone || 'N/A';
        const managerEmail = property.broker_email || property.owner_email || 'N/A';

        return text.replace(/{{title}}/g, property.title || 'this property')
                   .replace(/{{price}}/g, property.final_price || 'N/A')
                   .replace(/{{locality}}/g, property.locality || 'the location')
                   .replace(/{{size}}/g, property.size || 'N/A')
                   .replace(/{{username}}/g, user.display_name || user.username || 'User')
                   .replace(/{{user_email}}/g, user.email || 'N/A')
                   .replace(/{{user_phone}}/g, user.phone || 'N/A')
                   .replace(/{{manager_name}}/g, managerName)
                   .replace(/{{manager_phone}}/g, managerPhone)
                   .replace(/{{manager_email}}/g, managerEmail)
                   .replace(/{{owner_name}}/g, property.owner_name || 'the owner')
                   .replace(/{{broker_name}}/g, property.broker_name || 'the broker')
                   .replace(/{{current_time}}/g, new Date().toLocaleTimeString())
                   .replace(/{{current_date}}/g, new Date().toLocaleDateString());
    },

    // Send a welcome message
    async sendWelcome(io, propertyId, username) {
        try {
            // Check if user exists
            const userCheck = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
            if (userCheck.rows.length === 0) return;
            const user = userCheck.rows[0];

            const responseRes = await pool.query("SELECT response_text FROM bot_responses WHERE trigger_text = 'WELCOME_AWAY' LIMIT 1");
            if (responseRes.rows.length === 0) return;
            let reply = responseRes.rows[0].response_text;

            const propRes = await pool.query(`
                SELECT p.*, 
                       COALESCE(b.name, b.username) as broker_name, b.phone as broker_phone, b.email as broker_email,
                       COALESCE(o.name, o.username) as owner_name, o.phone as owner_phone, o.email as owner_email
                FROM properties p
                LEFT JOIN users b ON p.assigned_broker_id = b.id
                LEFT JOIN users o ON p.owner_id = o.id
                WHERE p.id = $1
            `, [propertyId]);
            const property = propRes.rows[0];
            if (!property) return;

            const finalReply = this.processTemplate(reply, user, property);

            // Save to DB and Emit
            const sakshRes = await pool.query("SELECT id FROM users WHERE username = 'Saksh'");
            const sakshId = sakshRes.rows[0]?.id;

            const convRes = await pool.query(`
                INSERT INTO property_conversations (property_id, buyer_id, owner_id, last_message, last_message_at, unread_count_buyer)
                SELECT $1::int, $2::int, p.owner_id, $3, NOW(), 1
                FROM properties p WHERE p.id = $1::int
                ON CONFLICT (property_id, buyer_id, owner_id) 
                DO UPDATE SET last_message = EXCLUDED.last_message, last_message_at = EXCLUDED.last_message_at, unread_count_buyer = property_conversations.unread_count_buyer + 1
                RETURNING id`
            , [propertyId, user.id, finalReply]);
            
            if (convRes.rowCount === 0) {
                console.error("[Bot] Failed to create/find conversation for welcome on property:", propertyId);
                return;
            }
            const conversationId = convRes.rows[0].id;

            await pool.query('INSERT INTO chat_messages (conversation_id, sender_id, content, visibility) VALUES ($1::int, $2::int, $3, $4)',
                [conversationId, sakshId, finalReply, 'bot']);

            const payload = {
                propertyId: propertyId,
                sender: 'Saksh',
                content: finalReply,
                tenantUsername: username,
                conversationId: conversationId
            };
            
            io.to(`property_${propertyId}_${username}`).to(`property_${propertyId}_management`).emit('receive_message', payload);
        } catch (err) { console.error("Welcome Bot error:", err); }
    },

    // Admin: Get all responses
    async getResponses() {
        const res = await pool.query("SELECT * FROM bot_responses ORDER BY id ASC");
        return res.rows;
    },

    // Admin: Add new response
    async addResponse(trigger, response) {
        await pool.query('INSERT INTO bot_responses (trigger_text, response_text) VALUES ($1, $2)', [trigger, response]);
    },

    // Admin: Update response
    async updateResponse(id, trigger, response) {
        await pool.query('UPDATE bot_responses SET trigger_text = $1, response_text = $2 WHERE id = $3', [trigger, response, id]);
    },

    // Admin: Delete response
    async deleteResponse(id) {
        await pool.query('DELETE FROM bot_responses WHERE id = $1', [id]);
    }
    , isRandomName: require('./utils').isRandomName // Expose for server.js middleware
};

module.exports = BotService;
