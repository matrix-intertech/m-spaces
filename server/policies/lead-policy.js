const pool = require('../db');
const { getPropertyAccessScope, propertyIsManagedByScope } = require('../property-access');
const { isManagedSalesAgent } = require('../sales-workflow-utils');
const { normalizeId, roleOf } = require('../services/authorization/utils');

async function load(leadId) {
    const id = normalizeId(leadId);
    if (!id) return null;
    const result = await pool.query(
        `SELECT l.*,
                p.owner_id AS property_owner_id,
                p.assigned_broker_id,
                p.assigned_brokers
         FROM leads l
         LEFT JOIN properties p ON p.id = l.property_id
         WHERE l.id = $1`,
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
    if (userId === normalizeId(subject.agent_id)) return true;

    if (['broker', 'builder'].includes(roleOf(user))) {
        if (await isManagedSalesAgent(user.id, subject.agent_id)) return true;
    }

    if (subject.property_owner_id || subject.assigned_broker_id || subject.assigned_brokers) {
        const scope = await getPropertyAccessScope(user);
        if (req) req.leadAccess = scope;
        if (propertyIsManagedByScope(subject, scope)) return true;
    }

    return false;
}

async function canAssign({ user, subject, context = {}, req }) {
    if (!['admin', 'broker', 'builder'].includes(roleOf(user))) return false;
    if (!(await canManage({ user, subject, req }))) return false;

    const targetAgentId = normalizeId(context.agentId || context.targetUserId || context.userId);
    if (!targetAgentId) return false;
    if (targetAgentId === normalizeId(user.id)) return true;
    return isManagedSalesAgent(user.id, targetAgentId);
}

async function canCreate({ user }) {
    return Boolean(user && ['admin', 'builder', 'broker', 'external_sales'].includes(roleOf(user)));
}

async function canView(args) {
    return canManage(args);
}

async function canEdit(args) {
    return canManage(args);
}

async function canDelete(args) {
    return canManage(args);
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
