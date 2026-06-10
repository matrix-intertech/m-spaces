// chat-ui-routes.js
const express = require('express');
const router = express.Router();
const pool = require('./db');

// Ensure user is authenticated middleware (reuse existing logic if any)
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// Inbox page – renders managed properties for managers OR personal conversations for buyers
router.get('/', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const userRole = req.session.user.role;
  const isManager = ['owner', 'broker', 'external_sales', 'dealer', 'builder', 'admin', 'support'].includes(userRole);
  const propertyId = req.query.propertyId;

  try {
    if (propertyId) {
        if (isManager) {
            // Managers see the list of inquiries for this property
            // Check if they actually manage it first to prevent unauthorized access
            const manageCheck = await pool.query(
                `SELECT id FROM properties 
                 WHERE id = $1::int 
                 AND ((owner_id = $2::int AND assigned_broker_id IS NULL AND COALESCE(array_length(assigned_brokers, 1), 0) = 0) OR assigned_broker_id = $2::int OR $2::int = ANY(COALESCE(assigned_brokers, '{}'::int[])))`,
                [propertyId, userId]
            );
            if (manageCheck.rowCount > 0) {
                return res.redirect(`/messages/property/${propertyId}`);
            }
        }
        
        // For buyers or managers who don't manage the property (e.g. they are inquiring as a buyer)
        // Find existing conversation
        let specificAgentCheck = '';
        let params = [propertyId, userId];
        if (req.query.agentId) {
            specificAgentCheck = ' AND owner_id = $3::int ';
            params.push(req.query.agentId);
        }
        const convRes = await pool.query(
            `SELECT id FROM property_conversations 
             WHERE property_id = $1::int AND (buyer_id = $2::int OR owner_id = $2::int) ${specificAgentCheck}
             LIMIT 1`,
            params
        );
        if (convRes.rowCount > 0) {
            return res.redirect(`/messages/${convRes.rows[0].id}`);
        }
    }

    if (isManager) {
        // Fetch properties managed by this user
        const props = await pool.query(`
            SELECT p.*, 
                   (SELECT COUNT(*) FROM property_conversations pc WHERE pc.property_id = p.id AND NOT ($1::int = ANY(COALESCE(pc.deleted_by, '{}'::int[])))) as inquiry_count,
                   (SELECT SUM(pc.unread_count_owner) FROM property_conversations pc WHERE pc.property_id = p.id AND pc.owner_id = $1::int) as unread_owner,
                   (SELECT SUM(pc.unread_count_buyer) FROM property_conversations pc WHERE pc.property_id = p.id AND pc.buyer_id = $1::int) as unread_buyer
            FROM properties p
            WHERE (p.owner_id = $1::int AND p.assigned_broker_id IS NULL AND COALESCE(array_length(p.assigned_brokers, 1), 0) = 0)
               OR p.assigned_broker_id = $1::int
               OR $1::int = ANY(COALESCE(p.assigned_brokers, '{}'::int[]))
            ORDER BY p.created_at DESC`,
            [userId]
        );
        
        // Also fetch personal conversations where they are the BUYER
        // AND check if they are favorited (shortlisted)
        const personalConvs = await pool.query(
            `SELECT pc.*, p.title AS property_title, p.photos,
                    (SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.property_id = p.id LIMIT 1) as is_shortlisted
             FROM property_conversations pc
             JOIN properties p ON pc.property_id = p.id
             WHERE pc.buyer_id = $1::int AND NOT ($1::int = ANY(COALESCE(pc.deleted_by, '{}'::int[])))
             ORDER BY pc.last_message_at DESC`,
            [userId]
        );

        res.render('chat-inbox', { 
            properties: props.rows, 
            personalConversations: personalConvs.rows,
            user: req.session.user,
            viewMode: 'manager'
        });
    } else {
        // Simple buyer inbox - check if favorited (shortlisted)
        const convs = await pool.query(
          `SELECT pc.id, pc.property_id, pc.owner_id, pc.last_message, pc.last_message_at, pc.unread_count_owner, pc.unread_count_buyer, p.title AS property_title, p.photos,
                  (SELECT 1 FROM favorites f WHERE f.user_id = $1 AND f.property_id = p.id LIMIT 1) as is_shortlisted
           FROM property_conversations pc
           JOIN properties p ON pc.property_id = p.id
           WHERE (pc.owner_id = $1::int OR pc.buyer_id = $1::int) AND NOT ($1::int = ANY(COALESCE(pc.deleted_by, '{}'::int[])))
           ORDER BY pc.last_message_at DESC`,
          [userId]
        );
        res.render('chat-inbox', { 
            conversations: convs.rows, 
            user: req.session.user,
            viewMode: 'buyer'
        });
    }
  } catch (e) {
    console.error('[Chat UI] Inbox error:', e);
    res.status(500).send('Server error');
  }
});

// Property-specific conversation list
router.get('/property/:propertyId', requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const propertyId = req.params.propertyId;
    try {
        // Verify user manages this property
        // Owner only has access if NO broker is assigned
        const propCheck = await pool.query(
            `SELECT title, photos FROM properties 
             WHERE id = $1::int 
             AND (
                (owner_id = $2::int AND assigned_broker_id IS NULL AND COALESCE(array_length(assigned_brokers, 1), 0) = 0) 
                OR assigned_broker_id = $2::int
                OR $2::int = ANY(COALESCE(assigned_brokers, '{}'::int[]))
             )`,
            [propertyId, userId]
        );
        if (propCheck.rowCount === 0) return res.status(403).send('Access denied (Broker assigned to this property)');

        const convs = await pool.query(
            `SELECT pc.*, u.username as buyer_name, u.name as buyer_display_name
             FROM property_conversations pc
             JOIN users u ON pc.buyer_id = u.id
             WHERE pc.property_id = $1::int AND NOT ($2::int = ANY(COALESCE(pc.deleted_by, '{}'::int[])))
             ORDER BY pc.last_message_at DESC`,
            [propertyId, userId]
        );

        res.render('property-conversations', { 
            conversations: convs.rows, 
            property: propCheck.rows[0],
            propertyId: propertyId,
            user: req.session.user 
        });
    } catch (e) {
        console.error('[Chat UI] Property conversations error:', e);
        res.status(500).send('Server error');
    }
});

// Single conversation view – renders chat window
router.get('/:convId', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const convId = req.params.convId;
  try {
    // Verify access
    const convRes = await pool.query(
      `SELECT pc.*, p.title AS property_title, p.photos, p.owner_id as prop_owner_id, p.assigned_broker_id
       FROM property_conversations pc
       JOIN properties p ON pc.property_id = p.id
       WHERE pc.id = $1::int 
       AND (
           pc.buyer_id = $2::int 
           OR p.assigned_broker_id = $2::int
           OR $2::int = ANY(COALESCE(p.assigned_brokers, '{}'::int[]))
           OR (p.owner_id = $2::int AND p.assigned_broker_id IS NULL AND COALESCE(array_length(p.assigned_brokers, 1), 0) = 0)
       )
       AND NOT ($2::int = ANY(COALESCE(pc.deleted_by, '{}'::int[])))`,
      [convId, userId]
    );
    if (convRes.rowCount === 0) return res.status(403).send('Access denied');
    const conversation = convRes.rows[0];

    // Fetch messages for this conversation
    const messagesRes = await pool.query(
        'SELECT * FROM chat_messages WHERE conversation_id = $1::int ORDER BY created_at ASC',
        [convId]
    );
    conversation.messages = messagesRes.rows;

    res.render('chat-window', { 
        conversation, 
        user: req.session.user,
        isMinimal: req.query.minimal === 'true'
    });

  } catch (e) {
    console.error('[Chat UI] Conversation view error:', e);
    res.status(500).send('Server error');
  }
});

module.exports = router;
