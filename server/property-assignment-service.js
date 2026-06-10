const pool = require('./db');

function normalizeId(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function uniqueIds(values) {
    return Array.from(new Set((values || []).map(normalizeId).filter(Boolean)));
}

function assignmentTypeForUser(user = {}) {
    const role = String(user.role || '').toLowerCase();
    if (role === 'owner') return 'owner';
    if (role === 'builder') return 'builder';
    if (role === 'broker') return 'broker';
    if (role === 'external_sales') {
        const salesAgentType = String(user.sales_agent_type || (user.parent_id ? 'associated' : 'independent')).toLowerCase();
        return salesAgentType === 'associated' ? 'associated_sales_agent' : 'independent_sales_agent';
    }
    return role || 'manager';
}

async function syncPropertyAssignments({ client = pool, propertyId, ownerId, assignedBrokerId, assignedBrokers }) {
    const normalizedPropertyId = normalizeId(propertyId);
    if (!normalizedPropertyId) return;

    const ownerUserId = normalizeId(ownerId);
    const managerIds = uniqueIds([
        assignedBrokerId,
        ...(Array.isArray(assignedBrokers) ? assignedBrokers : [])
    ]).filter((userId) => userId !== ownerUserId);

    const lookupIds = uniqueIds([ownerUserId, ...managerIds]);
    const usersById = new Map();

    if (lookupIds.length) {
        const usersRes = await client.query(
            `SELECT id, role, parent_id, sales_agent_type
             FROM users
             WHERE id = ANY($1::int[])`,
            [lookupIds]
        );
        for (const row of usersRes.rows) {
            usersById.set(Number(row.id), row);
        }
    }

    const rows = [];
    if (ownerUserId && usersById.has(ownerUserId)) {
        rows.push([normalizedPropertyId, ownerUserId, 'owner', 'active']);
    }
    for (const userId of managerIds) {
        const user = usersById.get(Number(userId));
        if (!user) continue;
        rows.push([normalizedPropertyId, Number(user.id), assignmentTypeForUser(user), 'active']);
    }

    await client.query('DELETE FROM property_assignments WHERE property_id = $1 AND status = $2', [normalizedPropertyId, 'active']);
    for (const row of rows) {
        await client.query(
            `INSERT INTO property_assignments (property_id, user_id, assignment_type, status)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            row
        );
    }
}

async function syncPropertyAssignmentsForProperty({ client = pool, propertyId }) {
    const normalizedPropertyId = normalizeId(propertyId);
    if (!normalizedPropertyId) return;

    const propertyRes = await client.query(
        `SELECT id, owner_id, assigned_broker_id, assigned_brokers
         FROM properties
         WHERE id = $1`,
        [normalizedPropertyId]
    );
    if (!propertyRes.rows.length) return;

    const property = propertyRes.rows[0];
    return syncPropertyAssignments({
        client,
        propertyId: property.id,
        ownerId: property.owner_id,
        assignedBrokerId: property.assigned_broker_id,
        assignedBrokers: property.assigned_brokers
    });
}

module.exports = {
    syncPropertyAssignments,
    syncPropertyAssignmentsForProperty
};
