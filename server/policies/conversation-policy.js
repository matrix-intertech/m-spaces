const pool = require('../db');
const {
    buildEffectiveManagerIdSql,
    getPropertyAccessScope,
    propertyIsManagedByScope
} = require('../property-access');
const { normalizeId } = require('../services/authorization/utils');

const EFFECTIVE_MANAGER_SQL = buildEffectiveManagerIdSql('p');

async function load(conversationId, req) {
    const convId = normalizeId(conversationId);
    const userId = normalizeId(req && req.session && req.session.user && req.session.user.id);
    if (!convId || !userId) return null;

    const result = await pool.query(
        `SELECT pc.*,
                p.owner_id AS property_owner_id,
                p.assigned_broker_id,
                p.assigned_brokers,
                p.title AS property_title,
                p.photos,
                p.final_price,
                p.size,
                p.listing_type,
                p.locality,
                ${EFFECTIVE_MANAGER_SQL} AS effective_manager_id
         FROM property_conversations pc
         JOIN properties p ON pc.property_id = p.id
         WHERE pc.id = $1::int
           AND NOT ($2::int = ANY(COALESCE(pc.deleted_by, '{}'::int[])))`,
        [convId, userId]
    );

    return result.rows[0] || null;
}

async function canManage({ user, subject, req }) {
    if (!user || !subject) return false;
    const scope = await getPropertyAccessScope(user);
    if (req) req.chatAccess = scope;

    const isBuyer = normalizeId(subject.buyer_id) === normalizeId(user.id);
    const isManager = propertyIsManagedByScope(subject, scope);
    return isBuyer || isManager;
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

async function canAssign() {
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
