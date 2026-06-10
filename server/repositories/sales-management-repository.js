const pool = require('../db');

async function updateVisitAssignment({ visitId, agentId, status }) {
    await pool.query(
        `UPDATE visits
         SET agent_id = $1,
             status = CASE WHEN status = 'completed' THEN status ELSE $2 END
         WHERE id = $3`,
        [agentId || null, status, visitId]
    );
}

async function createAssignedVisit({ propertyId, userId, agentId, scheduledAt, notes }) {
    await pool.query(
        `INSERT INTO visits (property_id, user_id, agent_id, scheduled_at, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [propertyId, userId, agentId, scheduledAt, 'assigned', notes]
    );
}

async function appendPropertyAssignment({ propertyId, agentId }) {
    await pool.query(
        `UPDATE properties
         SET assigned_broker_id = COALESCE(assigned_broker_id, $1),
             assigned_brokers = array_append(COALESCE(assigned_brokers, '{}'), $1)
         WHERE id = $2
           AND NOT ($1 = ANY(COALESCE(assigned_brokers, '{}')))`,
        [agentId, propertyId]
    );
}

async function updateVisitStatus({ visitId, status, notes }) {
    await pool.query(
        'UPDATE visits SET status = $1, notes = $2 WHERE id = $3',
        [status, notes, visitId]
    );
}

async function getVisitUserId(visitId) {
    const result = await pool.query('SELECT user_id FROM visits WHERE id = $1', [visitId]);
    return result.rows[0] ? result.rows[0].user_id : null;
}

async function verifyPendingReferralForUser(userId) {
    await pool.query(
        "UPDATE referrals SET status = 'verified' WHERE referred_user_id = $1 AND status = 'pending'",
        [userId]
    );
}

async function createLead({ agentId, name, phone, email, type, preferences, propertyId }) {
    try {
        await pool.query(
            `INSERT INTO leads (agent_id, name, phone, email, type, preferences, property_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [agentId, name, phone, email, type, preferences, propertyId || null, 'new']
        );
    } catch (_) {
        await pool.query(
            'INSERT INTO leads (agent_id, name, phone, email, type, preferences) VALUES ($1, $2, $3, $4, $5, $6)',
            [agentId, name, phone, email, type, preferences]
        );
    }
}

async function getPendingManagementRequest({ requestId, agentId }) {
    const result = await pool.query(
        "SELECT id, property_id, owner_id FROM property_management_requests WHERE id = $1 AND agent_id = $2 AND status = 'pending'",
        [requestId, agentId]
    );
    return result.rows[0] || null;
}

async function updateManagementRequestStatus({ requestId, status }) {
    await pool.query(
        'UPDATE property_management_requests SET status = $1, responded_at = NOW() WHERE id = $2',
        [status, requestId]
    );
}

async function reassignLead({ leadId, agentId }) {
    await pool.query('UPDATE leads SET agent_id = $1 WHERE id = $2', [agentId, leadId]);
}

async function updateLeadStatus({ leadId, status }) {
    await pool.query('UPDATE leads SET status = $1 WHERE id = $2', [status, leadId]);
}

module.exports = {
    updateVisitAssignment,
    createAssignedVisit,
    appendPropertyAssignment,
    updateVisitStatus,
    getVisitUserId,
    verifyPendingReferralForUser,
    createLead,
    getPendingManagementRequest,
    updateManagementRequestStatus,
    reassignLead,
    updateLeadStatus
};
