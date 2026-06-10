const { getUserPermissions } = require('./permission-utils');
const { normalizeId, roleOf } = require('./services/authorization/utils');
const { authorize, loadAuthorizationSubject, requireAuthorization } = require('./services/authorization');

function isAdminLike(user) {
    return roleOf(user) === 'admin';
}

async function getPropertyById(propertyId) {
    return loadAuthorizationSubject('property', propertyId);
}

async function canManageProperty(user, propertyOrId) {
    return authorize({
        user,
        resource: 'property',
        action: 'manage',
        subject: propertyOrId
    });
}

async function canCreateInquiry(user, propertyOrId) {
    return authorize({
        user,
        resource: 'property',
        action: 'inquire',
        subject: propertyOrId
    });
}

function requirePropertyPolicy(action, propertyId, options = {}) {
    return requireAuthorization('property', action, propertyId, {
        ...options,
        attachAs: 'authorizedProperty'
    });
}

async function hasPermission(user, permission) {
    if (!user || !permission) return false;
    if (isAdminLike(user)) return true;
    const permissions = await getUserPermissions(user.id);
    return permissions.includes(permission);
}

module.exports = {
    normalizeId,
    roleOf,
    isAdminLike,
    getPropertyById,
    canManageProperty,
    canCreateInquiry,
    requirePropertyPolicy,
    hasPermission
};
