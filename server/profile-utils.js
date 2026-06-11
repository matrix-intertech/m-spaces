const STANDARD_PROFILE_ROLES = new Set(['owner', 'tenant']);
const OWNER_PROFILE_ROLES = new Set(['owner']);
const CLIENT_HIDDEN_USER_FIELDS = new Set([
    'password_hash',
    'password_history',
    'two_factor_secret',
    'recovery_codes',
    'verification_token',
    'reset_password_token',
    'reset_password_expires',
    'pending_email_otp',
    'pending_email_expiry'
]);

function isStandardProfileRole(role) {
    return STANDARD_PROFILE_ROLES.has(String(role || '').toLowerCase());
}

function isOwnerProfileRole(role) {
    return OWNER_PROFILE_ROLES.has(String(role || '').toLowerCase());
}

function normalizeStandardProfileRole(role) {
    return String(role || '').toLowerCase();
}

function sanitizeUserForClient(user) {
    if (!user) return user;

    const safeUser = {};
    for (const [key, value] of Object.entries(user)) {
        if (CLIENT_HIDDEN_USER_FIELDS.has(key)) continue;
        safeUser[key] = value;
    }

    safeUser.role = normalizeStandardProfileRole(user.role);
    return safeUser;
}

function normalizeStandardProfileUser(user) {
    return sanitizeUserForClient(user);
}

module.exports = {
    isStandardProfileRole,
    isOwnerProfileRole,
    normalizeStandardProfileRole,
    normalizeStandardProfileUser,
    sanitizeUserForClient
};
