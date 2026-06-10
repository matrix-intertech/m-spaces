const pool = require('./db');

const ASSOCIATED = 'associated';
const INDEPENDENT = 'independent';

function normalizeSalesAgentType(user = {}) {
    if (!user || user.role !== 'external_sales') return null;
    const explicitType = String(user.sales_agent_type || '').toLowerCase();
    if (explicitType === ASSOCIATED || explicitType === INDEPENDENT) return explicitType;
    return user.parent_id ? ASSOCIATED : INDEPENDENT;
}

function normalizeParentType(role) {
    const value = String(role || '').toLowerCase();
    if (value === 'broker') return 'broker';
    if (value === 'builder') return 'builder';
    return value || null;
}

async function getSalesAgentContext(userOrId) {
    const userId = typeof userOrId === 'object' ? userOrId.id : userOrId;
    if (!userId) {
        return {
            isSalesAgent: false,
            salesAgentType: null,
            parentId: null,
            parentType: null,
            managerIds: []
        };
    }

    const userRes = await pool.query(`
        SELECT u.id, u.role, u.parent_id, u.sales_agent_type, u.parent_type, parent.role AS parent_role
        FROM users u
        LEFT JOIN users parent ON parent.id = u.parent_id
        WHERE u.id = $1
    `, [userId]);

    if (userRes.rows.length === 0 || userRes.rows[0].role !== 'external_sales') {
        return {
            isSalesAgent: false,
            salesAgentType: null,
            parentId: null,
            parentType: null,
            managerIds: []
        };
    }

    const user = userRes.rows[0];
    const salesAgentType = normalizeSalesAgentType(user);
    const parentId = user.parent_id || null;
    const parentType = normalizeParentType(user.parent_type || user.parent_role);
    const managerIds = salesAgentType === ASSOCIATED && parentId
        ? [parentId, user.id]
        : [user.id];

    return {
        isSalesAgent: true,
        salesAgentType,
        parentId,
        parentType,
        managerIds
    };
}

function salesAgentInsertFields(parentId, parentRole) {
    const hasParent = Boolean(parentId);
    return {
        salesAgentType: hasParent ? ASSOCIATED : INDEPENDENT,
        parentType: hasParent ? normalizeParentType(parentRole) : null
    };
}

module.exports = {
    ASSOCIATED,
    INDEPENDENT,
    normalizeSalesAgentType,
    normalizeParentType,
    getSalesAgentContext,
    salesAgentInsertFields
};
