const { getUserPermissions } = require('./permission-utils');
const { getSalesAgentContext } = require('./sales-agent-utils');

function normalizeId(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function normalizeAssignedBrokerIds(property = {}) {
    const assigned = new Set();
    const primaryAssignedBrokerId = normalizeId(property.assigned_broker_id);
    if (primaryAssignedBrokerId !== null) assigned.add(primaryAssignedBrokerId);

    const assignedBrokers = Array.isArray(property.assigned_brokers) ? property.assigned_brokers : [];
    assignedBrokers
        .map((value) => normalizeId(value))
        .filter((value) => value !== null)
        .forEach((value) => assigned.add(value));

    return Array.from(assigned);
}

function getEffectiveManagerId(property = {}) {
    const ownerId = normalizeId(property.owner_id);
    const assignedBrokerId = normalizeId(property.assigned_broker_id);
    if (assignedBrokerId !== null && assignedBrokerId !== ownerId) {
        return assignedBrokerId;
    }
    return ownerId;
}

function buildEffectiveManagerIdSql(alias = 'p') {
    return `CASE
        WHEN ${alias}.assigned_broker_id IS NOT NULL AND ${alias}.assigned_broker_id <> ${alias}.owner_id THEN ${alias}.assigned_broker_id
        ELSE ${alias}.owner_id
    END`;
}

async function getPropertyAccessScope(user) {
    const userId = normalizeId(user && user.id);
    const role = String(user && user.role || '').toLowerCase();

    if (!userId) {
        return {
            userId: null,
            role,
            managerIds: [],
            canModerateConversations: false
        };
    }

    let managerIds = [userId];
    if (role === 'external_sales') {
        const salesContext = await getSalesAgentContext(userId);
        managerIds = salesContext.managerIds.length
            ? salesContext.managerIds.map((value) => normalizeId(value)).filter((value) => value !== null)
            : [userId];
    }

    const permissions = await getUserPermissions(userId).catch(() => []);
    const canModerateConversations = role === 'admin' || role === 'support' || permissions.includes('view_messages');

    return {
        userId,
        role,
        managerIds: Array.from(new Set(managerIds)),
        canModerateConversations
    };
}

function propertyIsManagedByScope(property, scope) {
    if (!property || !scope || !scope.userId) return false;
    if (scope.canModerateConversations) return true;

    const managerIds = Array.isArray(scope.managerIds) ? scope.managerIds : [];
    if (!managerIds.length) return false;

    const assignedBrokerIds = normalizeAssignedBrokerIds(property);
    if (assignedBrokerIds.some((id) => managerIds.includes(id))) {
        return true;
    }

    if (!assignedBrokerIds.length) {
        const ownerId = normalizeId(property.owner_id);
        return ownerId !== null && managerIds.includes(ownerId);
    }

    return false;
}

module.exports = {
    normalizeAssignedBrokerIds,
    getEffectiveManagerId,
    buildEffectiveManagerIdSql,
    getPropertyAccessScope,
    propertyIsManagedByScope
};
