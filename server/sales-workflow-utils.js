const pool = require('./db');
const { getSalesAgentContext } = require('./sales-agent-utils');

function normalizeTaskStatus(status) {
    const value = String(status || 'pending').toLowerCase();
    if (['pending', 'in_progress', 'completed', 'cancelled'].includes(value)) return value;
    return 'pending';
}

function normalizeTransactionStatus(status) {
    const value = String(status || 'pending').toLowerCase();
    if (['pending', 'confirmed', 'closed', 'cancelled'].includes(value)) return value;
    return 'pending';
}

async function getSalesScopeIds(userId) {
    const context = await getSalesAgentContext(userId);
    return context.managerIds.length ? context.managerIds : [userId];
}

async function isManagedSalesAgent(managerId, targetUserId) {
    if (!managerId || !targetUserId) return false;
    if (Number(managerId) === Number(targetUserId)) return true;

    const targetRes = await pool.query(
        `SELECT id, role, parent_id, COALESCE(sales_agent_type, CASE WHEN parent_id IS NULL THEN 'independent' ELSE 'associated' END) AS sales_agent_type
         FROM users
         WHERE id = $1`,
        [targetUserId]
    );

    if (targetRes.rows.length === 0) return false;
    const target = targetRes.rows[0];
    return target.role === 'external_sales'
        && String(target.sales_agent_type || '').toLowerCase() === 'associated'
        && Number(target.parent_id) === Number(managerId);
}

module.exports = {
    normalizeTaskStatus,
    normalizeTransactionStatus,
    getSalesScopeIds,
    isManagedSalesAgent
};
