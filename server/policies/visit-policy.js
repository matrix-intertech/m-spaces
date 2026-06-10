const pool = require('../db');
const { getPropertyAccessScope, propertyIsManagedByScope } = require('../property-access');
const { isManagedSalesAgent } = require('../sales-workflow-utils');
const { normalizeId, roleOf } = require('../services/authorization/utils');

async function load(visitId) {
    const id = normalizeId(visitId);
    if (!id) return null;
    const result = await pool.query(
        `SELECT v.*,
                p.owner_id AS property_owner_id,
                p.assigned_broker_id,
                p.assigned_brokers
         FROM visits v
         JOIN properties p ON p.id = v.property_id
         WHERE v.id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

function isAdmin(user) {
    return roleOf(user) === 'admin';
}

async function canManage({ user, subject, req }) {
    if (!user || !subject) return false;
    if (isAdmin(user)) return true;

    const userId = normalizeId(user.id);
    if (userId === normalizeId(subject.user_id)) return true;
    if (userId === normalizeId(subject.property_owner_id)) return true;
    if (userId === normalizeId(subject.agent_id)) return true;

    const scope = await getPropertyAccessScope(user);
    if (req) req.visitAccess = scope;
    return propertyIsManagedByScope(subject, scope);
}

async function canAssign({ user, subject, context = {}, req }) {
    if (!['admin', 'builder', 'broker'].includes(roleOf(user))) return false;
    if (!(await canManage({ user, subject, req }))) return false;

    const targetAgentId = normalizeId(context.agentId || context.targetUserId || context.userId);
    if (!targetAgentId) return true;
    if (targetAgentId === normalizeId(user.id)) return true;
    return isManagedSalesAgent(user.id, targetAgentId);
}

async function canView(args) {
    return canManage(args);
}

async function canEdit(args) {
    return canManage(args);
}

async function canDelete() {
    return false;
}

async function canCreate({ user }) {
    return Boolean(user);
}

async function canTransfer() {
    return false;
}

module.exports = {
    load,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canAssign,
    canManage,
    canTransfer
};
