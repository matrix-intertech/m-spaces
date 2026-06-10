const SUPPORT_DEFAULT_PERMISSIONS = [
    'view_overview',
    'view_messages',
    'view_users',
    'manage_kyc'
];

const SUPPORT_ALLOWED_PERMISSIONS = new Set(SUPPORT_DEFAULT_PERMISSIONS);

const SUPPORT_BLOCKED_PERMISSIONS = new Set([
    'manage_properties',
    'manage_visits',
    'manage_corporate',
    'manage_users',
    'manage_sales',
    'manage_permissions',
    'manage_team',
    'manage_referrals',
    'manage_bot',
    'view_builder_dashboard',
    'manage_builder_kyc',
    'manage_builder_agents',
    'manage_builder_projects',
    'manage_builder_inventory',
    'manage_builder_leads',
    'manage_builder_visits',
    'manage_builder_portfolio',
    'manage_builder_requirements'
]);

function isSupport(userOrRole) {
    const role = typeof userOrRole === 'string' ? userOrRole : userOrRole && userOrRole.role;
    return String(role || '').toLowerCase() === 'support';
}

function applySupportDefaults(permissions) {
    const effective = new Set(permissions || []);
    SUPPORT_DEFAULT_PERMISSIONS.forEach((permission) => effective.add(permission));
    return effective;
}

function filterPermissions(permissions) {
    const effective = applySupportDefaults(permissions);
    SUPPORT_BLOCKED_PERMISSIONS.forEach((permission) => effective.delete(permission));
    return Array.from(effective).filter((permission) => SUPPORT_ALLOWED_PERMISSIONS.has(permission));
}

function can(permission) {
    return SUPPORT_ALLOWED_PERMISSIONS.has(permission) && !SUPPORT_BLOCKED_PERMISSIONS.has(permission);
}

module.exports = {
    SUPPORT_DEFAULT_PERMISSIONS,
    SUPPORT_ALLOWED_PERMISSIONS,
    SUPPORT_BLOCKED_PERMISSIONS,
    isSupport,
    applySupportDefaults,
    filterPermissions,
    can
};
