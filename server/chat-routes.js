// chat-routes.js
const express = require('express');
const router = express.Router();
const pool = require('./db');
const {
  buildEffectiveManagerIdSql,
  getPropertyAccessScope,
  propertyIsManagedByScope
} = require('./property-access');
const { authorize, loadAuthorizationSubject } = require('./services/authorization');
const { requireCsrf } = require('./csrf-protection');
const { createLeadForInquiry, logContactInquiry } = require('./inquiry-service');
const validate = require('./validate');
const { chatMessageSchema, chatStartSchema } = require('./validators/mutation-schemas');

const EFFECTIVE_MANAGER_SQL = buildEffectiveManagerIdSql('p');

async function loadConversation(convId, userId) {
  const result = await pool.query(
    `SELECT pc.*,
            p.owner_id AS property_owner_id,
            p.assigned_broker_id,
            p.assigned_brokers,
            p.title AS property_title,
            p.photos,
            p.final_price,
            p.size,
            p.listing_type,
            p.locality,
            NULL::text AS city,
            ${EFFECTIVE_MANAGER_SQL} AS effective_manager_id,
            buyer.username AS buyer_username,
            manager.username AS manager_username,
            CASE
              WHEN pc.buyer_id = $2::int THEN COALESCE(pc.unread_count_buyer, 0)
              ELSE COALESCE(pc.unread_count_owner, 0)
            END AS unread_count
     FROM property_conversations pc
     JOIN properties p ON pc.property_id = p.id
     LEFT JOIN users buyer ON buyer.id = pc.buyer_id
     LEFT JOIN users manager ON manager.id = ${EFFECTIVE_MANAGER_SQL}
     WHERE pc.id = $1::int
       AND NOT ($2::int = ANY(COALESCE(pc.deleted_by, '{}'::int[])))`,
    [convId, userId]
  );
  return result.rows[0] || null;
}

// Middleware to ensure user participates in the conversation
async function ensureConversationAccess(req, res, next) {
  const user = req.session.user;
  const userId = user?.id;
  const convId = req.params.convId;
  if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
  try {
    const [scope, conversation] = await Promise.all([
      getPropertyAccessScope(user),
      loadAuthorizationSubject('conversation', convId, req)
    ]);
    if (!conversation) return res.status(403).json({ error: 'Access denied (Broker assigned)' });

    const allowed = await authorize({
      user,
      resource: 'conversation',
      action: 'manage',
      subject: conversation,
      req
    });
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied (Broker assigned)' });
    }

    req.chatAccess = scope;
    req.conversation = conversation;
    next();
  } catch (e) {
    console.error('[chat-routes] Access check error:', e);
    res.status(500).json({ error: 'Server error' });
  }
}

// GET inbox list
router.get('/conversations', async (req, res) => {
  const user = req.session.user;
  const userId = user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthenticated' });
  try {
    const scope = await getPropertyAccessScope(user);

    const convs = await pool.query(
      `SELECT pc.*,
              p.title AS property_title,
              p.photos,
              p.final_price,
              CASE WHEN COALESCE(p.listing_type, '') <> 'rent' THEN p.final_price ELSE NULL END AS price,
              CASE WHEN COALESCE(p.listing_type, '') = 'rent' THEN p.final_price ELSE NULL END AS rent,
              p.size,
              p.listing_type,
              p.locality,
              NULL::text AS city,
              p.owner_id AS property_owner_id,
              p.assigned_broker_id,
              p.assigned_brokers,
              ${EFFECTIVE_MANAGER_SQL} AS effective_manager_id,
              buyer.username AS buyer_username,
              manager.username AS manager_username,
              CASE
                WHEN pc.buyer_id = $1::int THEN COALESCE(pc.unread_count_buyer, 0)
                ELSE COALESCE(pc.unread_count_owner, 0)
              END AS unread_count
       FROM property_conversations pc
       JOIN properties p ON p.id = pc.property_id
       LEFT JOIN users buyer ON buyer.id = pc.buyer_id
       LEFT JOIN users manager ON manager.id = ${EFFECTIVE_MANAGER_SQL}
       WHERE (
              pc.buyer_id = $1::int
              OR $2::boolean = TRUE
              OR p.assigned_broker_id = ANY($3::int[])
              OR EXISTS (
                SELECT 1
                FROM unnest(COALESCE(p.assigned_brokers, '{}'::int[])) AS assigned_broker(id)
                WHERE assigned_broker.id = ANY($3::int[])
              )
              OR (
                (p.assigned_broker_id IS NULL OR p.assigned_broker_id = p.owner_id)
                AND COALESCE(array_length(p.assigned_brokers, 1), 0) = 0
                AND p.owner_id = ANY($3::int[])
              )
            ) 
         AND NOT ($1::int = ANY(COALESCE(deleted_by, '{}'::int[])))
       ORDER BY pc.last_message_at DESC`,
      [userId, scope.canModerateConversations, scope.managerIds]
    );
    res.json({ conversations: convs.rows });
  } catch (e) {
    console.error('[chat-routes] List error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET messages with pagination
router.get('/conversations/:convId/messages', ensureConversationAccess, async (req, res) => {
  const { convId } = req.params;
  const offset = parseInt(req.query.offset) || 0;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const userId = req.session.user.id;
  try {
    const msgs = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE conversation_id = $1::int 
         AND NOT ($2::int = ANY(COALESCE(deleted_by, '{}'::int[])))
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [convId, userId, limit, offset]
    );
    res.json({ messages: msgs.rows });
  } catch (e) {
    console.error('[chat-routes] Message fetch error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST start or fetch existing conversation for a property (buyer initiates)
router.post('/conversations/:propertyId/start', requireCsrf, validate(chatStartSchema), async (req, res) => {
  const buyerId = req.session.user?.id;
  if (!buyerId) return res.status(401).json({ error: 'Unauthenticated' });
  const propertyId = req.params.propertyId;
  try {
    // Fetch property manager (assigned broker first, then owner fallback)
    const prop = await pool.query('SELECT id, title, listing_type, owner_id, assigned_broker_id, assigned_brokers FROM properties WHERE id = $1::int', [propertyId]);
    if (prop.rowCount === 0) return res.status(404).json({ error: 'Property not found' });
    const property = prop.rows[0];
    const ownerId = (() => {
      const row = property;
      if (row.assigned_broker_id && row.assigned_broker_id !== row.owner_id) return row.assigned_broker_id;
      return row.owner_id;
    })();
    const convRes = await pool.query(
      `INSERT INTO property_conversations (property_id, buyer_id, owner_id, last_message_at) 
       VALUES ($1::int, $2::int, $3::int, NOW()) 
       ON CONFLICT (property_id, buyer_id, owner_id) DO UPDATE SET last_message_at = NOW() 
      RETURNING id`,
      [propertyId, buyerId, ownerId]
    );
    await logContactInquiry({
      propertyId: property.id,
      requesterId: req.session.user.id,
      requesterEmail: req.session.user.email,
      managerId: ownerId,
      channel: 'chat_start',
      req
    }).catch((error) => console.error('[chat-routes] Inquiry log error:', error));
    await createLeadForInquiry({
      managerId: ownerId,
      requester: req.session.user,
      property,
      preferencesPrefix: 'Chat inquiry'
    }).catch((error) => console.error('[chat-routes] Lead creation error:', error));
    res.json({ conversationId: convRes.rows[0].id });
  } catch (e) {
    console.error('[chat-routes] Start conv error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST new message
router.post('/conversations/:convId/message', validate(chatMessageSchema), ensureConversationAccess, async (req, res) => {
  const { convId } = req.params;
  const { content } = req.body;
  const senderId = req.session.user.id;
  if (!content || typeof content !== 'string') return res.status(400).json({ error: 'Invalid content' });
  try {
    const senderIsBuyer = Number(req.conversation?.buyer_id) === Number(senderId);
    const senderIsManagement = !senderIsBuyer && (
      req.chatAccess?.canModerateConversations ||
      propertyIsManagedByScope(req.conversation, req.chatAccess)
    );
    const msgRes = await pool.query(
      `INSERT INTO chat_messages (conversation_id, sender_id, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [convId, senderId, content]
    );
    // Update conversation metadata
    await pool.query(
      `UPDATE property_conversations
       SET last_message = $1,
           last_message_at = NOW(),
           unread_count_owner = CASE WHEN $2::boolean THEN unread_count_owner ELSE unread_count_owner + 1 END,
           unread_count_buyer = CASE WHEN $3::boolean THEN unread_count_buyer ELSE unread_count_buyer + 1 END
       WHERE id = $4::int`,
      [content, senderIsManagement, senderIsBuyer, convId]
    );
    // Emit via Socket.IO – socket middleware will handle broadcasting
    res.json({ message: msgRes.rows[0] });
  } catch (e) {
    console.error('[chat-routes] Send message error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH mark as read (reset unread counters)
router.patch('/conversations/:convId/read', ensureConversationAccess, async (req, res) => {
  const { convId } = req.params;
  const userId = req.session.user.id;
  try {
    const conv = req.conversation;
    if (Number(userId) === Number(conv.buyer_id)) {
      await pool.query('UPDATE property_conversations SET unread_count_buyer = 0 WHERE id = $1::int', [convId]);
    } else if (req.chatAccess?.canModerateConversations || propertyIsManagedByScope(conv, req.chatAccess)) {
      await pool.query('UPDATE property_conversations SET unread_count_owner = 0 WHERE id = $1::int', [convId]);
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
    // Also mark messages as read for this user
    await pool.query('UPDATE chat_messages SET is_read = TRUE WHERE conversation_id = $1 AND sender_id <> $2', [convId, userId]);
    res.json({ success: true });
  } catch (e) {
    console.error('[chat-routes] Mark read error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE soft‑delete for current user
router.delete('/conversations/:convId', ensureConversationAccess, async (req, res) => {
  const { convId } = req.params;
  const userId = req.session.user.id;
  try {
    await pool.query(
      `UPDATE property_conversations SET deleted_by = array_append(COALESCE(deleted_by, '{}'::int[]), $1) WHERE id = $2`,
      [userId, convId]
    );
    await pool.query(
      `UPDATE chat_messages SET deleted_by = array_append(COALESCE(deleted_by, '{}'::int[]), $1) WHERE conversation_id = $2`,
      [userId, convId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('[chat-routes] Delete error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST toggle bot for a conversation
router.post('/conversations/:convId/toggle-bot', ensureConversationAccess, async (req, res) => {
    const { convId } = req.params;
    const { enabled } = req.body;
    try {
        await pool.query('UPDATE property_conversations SET bot_enabled = $1 WHERE id = $2::int', [enabled, convId]);
        res.json({ success: true, bot_enabled: enabled });
    } catch (e) {
        console.error('[chat-routes] Bot toggle error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
