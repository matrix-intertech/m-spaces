const pool = require('../db');
const { getSalesAgentContext } = require('../sales-agent-utils');
const { isManagedSalesAgent } = require('../sales-workflow-utils');
const { normalizeId, roleOf } = require('../services/authorization/utils');

const ADMIN_ROLES = new Set(['admin']);
const OWNER_ROLES = new Set(['owner']);
const MANAGER_ROLES = new Set(['builder', 'broker', 'external_sales']);

function assignedIds(property) {
    const ids = new Set();
    const primary = normalizeId(property && property.assigned_broker_id);
    if (primary) ids.add(primary);
    const assigned = Array.isArray(property && property.assigned_brokers) ? property.assigned_brokers : [];
    assigned.map(normalizeId).filter(Boolean).forEach((id) => ids.add(id));
    return ids;
}

async function managerScopeIds(user) {
    const userId = normalizeId(user && user.id);
    if (!userId) return [];
    if (roleOf(user) !== 'external_sales') return [userId];

    const context = await getSalesAgentContext(userId);
    if (context.managerIds && context.managerIds.length) {
        return context.managerIds.map(normalizeId).filter(Boolean);
    }
    return [userId];
}

async function load(propertyId) {
    const id = normalizeId(propertyId);
    if (!id) return null;
    const result = await pool.query(
        'SELECT id, owner_id, assigned_broker_id, assigned_brokers, status, locality FROM properties WHERE id = $1',
        [id]
    );
    return result.rows[0] || null;
}

function isAdmin(user) {
    return ADMIN_ROLES.has(roleOf(user));
}

async function canManage({ user, subject }) {
    if (!user) return false;
    if (isAdmin(user)) return true;
    if (!subject) return false;

    const userId = normalizeId(user.id);
    if (!userId) return false;

    if (OWNER_ROLES.has(roleOf(user)) && normalizeId(subject.owner_id) === userId) return true;
    if (!MANAGER_ROLES.has(roleOf(user))) return false;

    const managers = await managerScopeIds(user);
    const assigned = assignedIds(subject);
    return managers.some((managerId) => assigned.has(managerId));
}

async function canAssign({ user, subject, context = {} }) {
    if (!(await canManage({ user, subject, context }))) return false;
    const targetUserId = normalizeId(context.agentId || context.userId || context.targetUserId);
    if (!targetUserId) return true;

    if (targetUserId === normalizeId(user.id)) return true;
    const role = roleOf(user);
    if (!['broker', 'builder'].includes(role)) return false;
    return isManagedSalesAgent(user.id, targetUserId);
}

async function canDelete({ user, subject }) {
    if (!user || !subject) return false;
    if (isAdmin(user)) return true;
    return OWNER_ROLES.has(roleOf(user)) && normalizeId(subject.owner_id) === normalizeId(user.id);
}

async function canCreate({ user }) {
    return Boolean(user && ['admin', 'owner', 'builder', 'broker', 'external_sales'].includes(roleOf(user)));
}

async function canView({ user, subject }) {
    if (!subject) return false;
    if (subject.status === 'listed' || subject.status === 'verified') return true;
    return canManage({ user, subject });
}

async function canEdit(args) {
    return canManage(args);
}

async function canTransfer() {
    return false;
}

async function canInquire({ user, subject }) {
    if (!user || !subject) return false;
    return !(await canManage({ user, subject }));
}

module.exports = {
    load,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canAssign,
    canManage,
    canTransfer,
    canInquire
};
