const pool = require('./db');
const supportPolicy = require('./policies/support-policy');
const { fetchWithCache, invalidateCache } = require('./redis-cache');

const BUILDER_DEFAULT_PERMISSIONS = [
    'view_builder_dashboard',
    'manage_builder_kyc',
    'manage_builder_agents',
    'manage_builder_projects',
    'manage_builder_inventory',
    'manage_builder_leads',
    'manage_builder_visits',
    'manage_builder_portfolio',
    'manage_builder_requirements',
    'manage_properties',
    'view_messages',
    'manage_visits',
    'manage_sales'
];

const SALES_DEFAULT_PERMISSIONS = [
    'view_overview',
    'view_messages',
    'manage_properties',
    'manage_visits',
    'manage_sales',
    'manage_corporate'
];

const INDEPENDENT_SALES_DEFAULT_PERMISSIONS = [
    ...SALES_DEFAULT_PERMISSIONS
];

function permissionCacheKey(userId) {
    return `permissions:user:${userId}`;
}

async function loadUserPermissions(userId) {
    if (!userId) return [];
    const userRes = await pool.query('SELECT role, parent_id, sales_agent_type FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return [];

    const user = userRes.rows[0];
    const roleName = user.role;
    if (roleName === 'admin') {
        const allPermsRes = await pool.query('SELECT name FROM permissions');
        return allPermsRes.rows.map((permission) => permission.name);
    }

    const rolePermsRes = await pool.query(`
        SELECT p.name
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_name = $1
    `, [roleName]);
    const effectivePerms = new Set(rolePermsRes.rows.map((row) => row.name));

    if (roleName === 'builder') {
        BUILDER_DEFAULT_PERMISSIONS.forEach((permission) => effectivePerms.add(permission));
    }

    if (roleName === 'external_sales') {
        const salesAgentType = String(user.sales_agent_type || (user.parent_id ? 'associated' : 'independent')).toLowerCase();
        if (salesAgentType === 'independent') {
            INDEPENDENT_SALES_DEFAULT_PERMISSIONS.forEach((permission) => effectivePerms.add(permission));
        } else {
            SALES_DEFAULT_PERMISSIONS.forEach((permission) => effectivePerms.add(permission));
            effectivePerms.delete('manage_team');
        }
    }

    const userOverridesRes = await pool.query(`
        SELECT p.name, up.is_granted
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        WHERE up.user_id = $1
    `, [userId]);

    userOverridesRes.rows.forEach((override) => {
        if (override.is_granted) {
            effectivePerms.add(override.name);
        } else {
            effectivePerms.delete(override.name);
        }
    });

    if (supportPolicy.isSupport(roleName)) {
        return supportPolicy.filterPermissions(effectivePerms);
    }

    return Array.from(effectivePerms);
}

async function getUserPermissions(userId) {
    if (!userId) return [];
    return fetchWithCache(permissionCacheKey(userId), 60, () => loadUserPermissions(userId));
}

async function invalidateUserPermissionCache(userId) {
    if (!userId) return;
    await invalidateCache(permissionCacheKey(userId));
}

async function invalidateRolePermissionCache(roleName) {
    if (!roleName) return;
    const usersRes = await pool.query('SELECT id FROM users WHERE role = $1', [roleName]);
    await Promise.all(usersRes.rows.map((row) => invalidateUserPermissionCache(row.id)));
}

function hasPermission(permission) {
    return async (req, res, next) => {
        if (!req.session.user) return res.status(401).send('Authentication required.');
        const userPermissions = await getUserPermissions(req.session.user.id);
        if (userPermissions.includes(permission)) return next();

        if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            return res.status(403).json({ error: 'Forbidden: You do not have the required permission.' });
        }
        return res.status(403).send(`<div style="font-family: sans-serif; text-align: center; padding: 40px;"><h1>403 Forbidden</h1><p>You do not have permission to perform this action.</p></div>`);
    };
}

function hasAnyPermission(requiredPermissions = []) {
    return async (req, res, next) => {
        if (!req.session.user) return res.status(401).send('Authentication required.');
        const userPermissions = await getUserPermissions(req.session.user.id);
        if (requiredPermissions.some((permission) => userPermissions.includes(permission))) return next();

        if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            return res.status(403).json({ error: 'Forbidden: You do not have the required permission.' });
        }
        return res.status(403).send(`<div style="font-family: sans-serif; text-align: center; padding: 40px;"><h1>403 Forbidden</h1><p>You do not have permission to perform this action.</p></div>`);
    };
}

module.exports = {
    getUserPermissions,
    invalidateUserPermissionCache,
    invalidateRolePermissionCache,
    hasPermission,
    hasAnyPermission,
    supportPolicy
};
