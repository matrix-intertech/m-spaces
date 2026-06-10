const pool = require('../db');

async function createTask({ title, description, createdBy, assignedTo, parentId, relatedPropertyId, relatedLeadId, dueAt, notes }) {
    await pool.query(
        `INSERT INTO agent_tasks (title, description, created_by, assigned_to, parent_id, related_property_id, related_lead_id, due_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [title, description, createdBy, assignedTo, parentId, relatedPropertyId, relatedLeadId, dueAt, notes]
    );
}

async function getTask(taskId) {
    const result = await pool.query(
        'SELECT id, assigned_to, created_by FROM agent_tasks WHERE id = $1',
        [taskId]
    );
    return result.rows[0] || null;
}

async function getAssignedTask(taskId, userId) {
    const result = await pool.query(
        'SELECT id, assigned_to, created_by FROM agent_tasks WHERE id = $1 AND assigned_to = $2',
        [taskId, userId]
    );
    return result.rows[0] || null;
}

async function updateTask({ taskId, status, notes }) {
    await pool.query(
        `UPDATE agent_tasks
         SET status = $1,
             notes = COALESCE($2, notes),
             completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
         WHERE id = $3`,
        [status, notes, taskId]
    );
}

async function createTransaction({ agentId, propertyId, counterpartyName, amount, stage, status, notes }) {
    await pool.query(
        `INSERT INTO sales_transactions (agent_id, property_id, counterparty_name, amount, stage, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [agentId, propertyId, counterpartyName, amount, stage, status, notes]
    );
}

async function createSchedule({ agentId, title, description, scheduledAt, type, referenceId }) {
    await pool.query(
        'INSERT INTO agent_schedules (agent_id, title, description, scheduled_at, type, reference_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [agentId, title, description, scheduledAt, type, referenceId]
    );
}

async function getAccessibleLeadForSchedule({ referenceId, userId, role }) {
    const result = await pool.query(
        `SELECT name, email, property_id
         FROM leads
         WHERE id = $1
           AND (
             agent_id = $2
             OR $3 IN ('broker', 'builder')
           )`,
        [referenceId, userId, role]
    );
    return result.rows[0] || null;
}

async function getScheduleReference(scheduleId, agentId) {
    const result = await pool.query(
        'SELECT reference_id FROM agent_schedules WHERE id = $1 AND agent_id = $2',
        [scheduleId, agentId]
    );
    return result.rows[0] || null;
}

async function updateSchedule({ scheduleId, agentId, title, description, scheduledAt, status, type }) {
    await pool.query(
        'UPDATE agent_schedules SET title = $1, description = $2, scheduled_at = $3, status = $4, type = $5 WHERE id = $6 AND agent_id = $7',
        [title, description, scheduledAt, status, type, scheduleId, agentId]
    );
}

async function getLeadById(leadId) {
    const result = await pool.query(
        'SELECT name, email, property_id FROM leads WHERE id = $1',
        [leadId]
    );
    return result.rows[0] || null;
}

async function getPropertyVisitEmailContext(propertyId) {
    const result = await pool.query(
        'SELECT p.title as property_title, p.latitude, p.longitude, u.email as owner_email FROM properties p JOIN users u ON p.owner_id = u.id WHERE p.id = $1',
        [propertyId]
    );
    return result.rows[0] || null;
}

async function deleteSchedule(scheduleId, agentId) {
    await pool.query(
        'DELETE FROM agent_schedules WHERE id = $1 AND agent_id = $2',
        [scheduleId, agentId]
    );
}

module.exports = {
    createTask,
    getTask,
    getAssignedTask,
    updateTask,
    createTransaction,
    createSchedule,
    getAccessibleLeadForSchedule,
    getScheduleReference,
    updateSchedule,
    getLeadById,
    getPropertyVisitEmailContext,
    deleteSchedule
};
