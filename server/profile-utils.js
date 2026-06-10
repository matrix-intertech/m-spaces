const STANDARD_PROFILE_ROLES = new Set(['owner', 'tenant']);
const OWNER_PROFILE_ROLES = new Set(['owner']);

function isStandardProfileRole(role) {
    return STANDARD_PROFILE_ROLES.has(String(role || '').toLowerCase());
}

function isOwnerProfileRole(role) {
    return OWNER_PROFILE_ROLES.has(String(role || '').toLowerCase());
}

function normalizeStandardProfileRole(role) {
    return String(role || '').toLowerCase();
}

function normalizeStandardProfileUser(user) {
    if (!user) return user;
    return {
        ...user,
        role: normalizeStandardProfileRole(user.role)
    };
}

module.exports = {
    isStandardProfileRole,
    isOwnerProfileRole,
    normalizeStandardProfileRole,
    normalizeStandardProfileUser
};
