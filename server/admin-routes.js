const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const pool = require('./db');
const BotService = require('./bot-service');
const notificationService = require('./notification-service');
const { validatePassword, addToPasswordHistory, generateUniqueUsername } = require('./utils');
const { fetchWithCache, invalidateCache } = require('./redis-cache');
const { emailQueue } = require('./email-queue');
const waService = require('./whatsappService');
const { getUserPermissions, invalidateUserPermissionCache, invalidateRolePermissionCache } = require('./permission-utils');
const adminPolicy = require('./policies/admin-policy');
const adminReferralController = require('./controllers/admin-referral-controller');
const validate = require('./validate');
const {
    leadCreateSchema,
    leadDeleteSchema,
    leadStatusSchema,
    visitAssignSchema,
    visitCreateAssignSchema,
    visitStatusSchema
} = require('./validators/mutation-schemas');

const RESERVED_USERNAMES = new Set([
    'admin', 'support', 'login', 'logout', 'signup', 'register', 'auth',
    'search', 'property', 'properties', 'compare', 'requirements', 'favorites',
    'recently-viewed', 'my-chats', 'messages', 'visits', 'notifications',
    'profile', 'edit-profile', 'avatar-studio', 'wallet', 'vault', 'list-property',
    'owner', 'broker', 'builder', 'external-sales', 'corporate', 'dealer', 'agent',
    'contact', 'report', 'services', 'agents', 'about', 'privacy', 'terms', 'help',
    'team', 'blog', 'news', 'jobs', 'careers', 'press', 'media', 'status', 'docs',
    'api', 'assets', 'css', 'js', 'img', 'images', 'uploads', 'kyc-file', 'socket.io',
    'portfolio', 'root', 'info', 'test', 'testing', 'matrix', 'matrixspaces', 'saksh'
]);

const normalizeIndiaCoordinates = (rawLat, rawLng) => {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    const isValid = (valueLat, valueLng) => (
        Number.isFinite(valueLat) && Number.isFinite(valueLng) &&
        valueLat >= 6 && valueLat <= 38 && valueLng >= 68 && valueLng <= 98
    );

    if (isValid(lat, lng)) return { lat, lng };
    if (isValid(lng, lat)) return { lat: lng, lng: lat };
    return null;
};

const normalizeSubmittedCoordinates = (lat, lng, latitude, longitude) => (
    normalizeIndiaCoordinates(lat, lng) ||
    normalizeIndiaCoordinates(latitude, longitude)
);

function stableCachePart(value) {
    if (Array.isArray(value)) return value.map((entry) => stableCachePart(entry)).join(',');
    if (value === undefined || value === null || value === '') return 'na';
    return String(value);
}

function adminCacheKey(scope, role, extras = {}) {
    const serialized = Object.keys(extras)
        .sort()
        .map((key) => `${key}:${stableCachePart(extras[key])}`)
        .join('|');
    return `admin:${scope}:${String(role || '').toLowerCase()}:${serialized}`;
}

async function cachedRows(cacheKey, ttlSeconds, query, params = []) {
    return fetchWithCache(cacheKey, ttlSeconds, async () => (await pool.query(query, params)).rows);
}

module.exports = function(upload, transporter) {
    const router = express.Router();

    // ─── PERMISSION HELPERS ───────────────────────────────────────────────────
    const hasPermission = (permission) => async (req, res, next) => {
        if (!req.session.user) return res.status(401).send('Authentication required.');
        
        const userPermissions = await getUserPermissions(req.session.user.id);
        
        if (userPermissions.includes(permission)) {
            return next();
        } else {
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
                return res.status(403).json({ error: 'Forbidden: You do not have the required permission.' });
            }
            return res.status(403).send(`<div style="font-family: sans-serif; text-align: center; padding: 40px;"><h1>403 Forbidden</h1><p>You do not have permission to perform this action.</p><a href="/admin">Back to Dashboard</a></div>`);
        }
    };

    // Admin Dashboard Overview
    router.get('/', async (req, res) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
        const effectivePermissions = await getUserPermissions(req.session.user.id);
        const can = (p) => effectivePermissions.includes(p);

        if (!can('view_overview')) {
            if (wantsJson) return res.status(403).json({ error: 'Forbidden: You do not have permission to access the admin dashboard.' });
            return res.status(403).send(`<div style="font-family: sans-serif; text-align: center; padding: 40px;"><h1>403 Forbidden</h1><p>You do not have permission to access the admin dashboard.</p><a href="/">Back to Home</a></div>`);
        }
        
        const { search, sort, ajax_active_listings, page, users_page, visits_page } = req.query;
        const activeTab = String(req.query.tab || 'overview');
        const isOverviewTab = activeTab === 'overview';
        const needsActiveListings = Boolean(ajax_active_listings) || isOverviewTab;
        const needsPermissionData = can('manage_permissions');
        const needsUsers = activeTab === 'users' || activeTab === 'permissions' || needsPermissionData;
        const needsTeam = activeTab === 'team';
        const needsVisits = activeTab === 'visits';
        const needsMessages = activeTab === 'messages';
        const needsKyc = activeTab === 'kyc';
        const needsSales = activeTab === 'sales';
        const needsCorporate = activeTab === 'corporate';
        const needsReferrals = activeTab === 'referrals';
        const needsBot = activeTab === 'bot';
        const needsContact = activeTab === 'contact' || activeTab === 'reports';

        // PII Masking Helpers for lower-tier admin/support staff
        const isSupport = req.session.user.role === 'support';
        const maskEmail = (email) => {
            if (!email) return '';
            if (!isSupport) return email;
            const parts = String(email).split('@');
            if (parts.length !== 2) return String(email).substring(0, 2) + '***';
            return `${parts[0].substring(0, 2)}***@${parts[1]}`;
        };
        const maskPhone = (phone) => {
            if (!phone) return '';
            if (!isSupport) return phone;
            const str = String(phone);
            if (str.length <= 4) return str;
            return '*'.repeat(str.length - 4) + str.slice(-4);
        };
        const maskSupportRows = (rows) => {
            if (!isSupport || !Array.isArray(rows)) return rows;
            const emailFields = ['email', 'owner_email', 'renter_email', 'reporter_email'];
            const phoneFields = ['phone', 'owner_phone', 'renter_phone'];
            return rows.map((row) => {
                const masked = { ...row };
                emailFields.forEach((field) => {
                    if (field in masked) masked[field] = maskEmail(masked[field]);
                });
                phoneFields.forEach((field) => {
                    if (field in masked) masked[field] = maskPhone(masked[field]);
                });
                return masked;
            });
        };

        const propertyQuery = `
            SELECT p.id, p.owner_id, p.title, p.locality, p.contact, p.latitude, p.longitude, p.status, p.photos, 
                   p.estimated_min, p.estimated_max, p.final_price, p.infra_plan, p.size, p.condition, 
                   p.listed_at, p.created_at, p.is_matrix_verified, p.type, p.listing_type, p.model_path,
                   p.verification_status, p.verification_notes, p.verified_at,
                   u.username AS owner_name
            FROM properties p
            LEFT JOIN users u ON p.owner_id = u.id
        `;

        const [pendingRows, visitReportRows, verifiedRows] = await Promise.all([
            can('view_overview') && isOverviewTab
                ? cachedRows(
                    adminCacheKey('overview-pending', req.session.user.role, { tab: activeTab }),
                    15,
                    `${propertyQuery} WHERE p.verification_status IN ('Unverified', 'Under Review') AND p.id NOT IN (SELECT property_id FROM visits WHERE status = 'completed')`
                )
                : Promise.resolve([]),
            can('view_overview') && isOverviewTab
                ? cachedRows(
                    adminCacheKey('overview-visit-reports', req.session.user.role, { tab: activeTab }),
                    15,
                    `${propertyQuery} WHERE p.verification_status IN ('Unverified', 'Under Review') AND p.id IN (SELECT property_id FROM visits WHERE status = 'completed')`
                )
                : Promise.resolve([]),
            can('view_overview') && isOverviewTab
                ? cachedRows(
                    adminCacheKey('overview-verified', req.session.user.role, { tab: activeTab }),
                    15,
                    `${propertyQuery} WHERE p.verification_status = 'Premium Verified'`
                )
                : Promise.resolve([])
        ]);
        
        let activeBaseQueryStr = can('manage_properties') && needsActiveListings ? `${propertyQuery} WHERE p.status IN ('listed', 'reviewing', 'negotiating', 'unlisted')` : '';
        const activeParams = [];
        
        if (search && search.trim()) {
            // Format search terms for tsquery (e.g. "office delhi" -> "office:* & delhi:*")
            const cleanSearch = search.trim().replace(/^#/, '');
            const formattedSearch = cleanSearch.split(/\s+/).filter(Boolean).map(term => `${term}:*`).join(' & ');
            if (formattedSearch) {
                activeParams.push(formattedSearch);
                const paramIdx = activeParams.length;
                
                let idSearchPart = '';
                const propIdMatch = cleanSearch.match(/^\d+$/);
                if (propIdMatch) {
                    activeParams.push(parseInt(propIdMatch[0], 10));
                    idSearchPart = ` OR p.id = $${activeParams.length}`;
                }
                activeBaseQueryStr += ` AND (
                    to_tsvector('simple', coalesce(p.title, '') || ' ' || coalesce(p.locality, '') || ' ' || coalesce(p.type, '') || ' ' || coalesce(p.status, '') || ' ' || coalesce(p.listing_type, '')) @@ to_tsquery('simple', $${paramIdx})
                    OR to_tsvector('simple', coalesce(u.username, '')) @@ to_tsquery('simple', $${paramIdx})
                    ${idSearchPart}
                )`;
            }
        }
        
        let sortClause = 'p.created_at DESC';
        if (sort === 'title_asc') sortClause = 'p.title ASC';
        else if (sort === 'title_desc') sortClause = 'p.title DESC';
        else if (sort === 'owner_asc') sortClause = 'u.username ASC';
        else if (sort === 'owner_desc') sortClause = 'u.username DESC';
        else if (sort === 'price_asc') sortClause = 'p.final_price ASC';
        else if (sort === 'price_desc') sortClause = 'p.final_price DESC';
        else if (sort === 'status_asc') sortClause = 'p.status ASC';
        else if (sort === 'status_desc') sortClause = 'p.status DESC';
        else if (sort === 'created_at_asc') sortClause = 'p.created_at ASC';
        else if (sort === 'created_at_desc') sortClause = 'p.created_at DESC';
        else if (sort === 'verification_asc') sortClause = 'p.verification_status ASC';
        else if (sort === 'verification_desc') sortClause = 'p.verification_status DESC';
        else if (sort === 'type_asc') sortClause = 'p.type ASC';
        else if (sort === 'type_desc') sortClause = 'p.type DESC';
        else if (sort === 'listing_type_asc') sortClause = 'p.listing_type ASC';
        else if (sort === 'listing_type_desc') sortClause = 'p.listing_type DESC';

        const currentPage = parseInt(page) || 1;
        const limit = ajax_active_listings ? Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 1000) : 50;
        const offset = (currentPage - 1) * limit;
        let activeQueryStr = activeBaseQueryStr ? `${activeBaseQueryStr} ORDER BY ${sortClause}` : '';
        const activeCountParams = [...activeParams];
        const activeCountQuery = activeBaseQueryStr ? `SELECT COUNT(*) AS total FROM (${activeBaseQueryStr}) AS active_base` : '';
        if (activeQueryStr) {
            activeParams.push(limit);
            const limitIdx = activeParams.length;
            activeParams.push(offset);
            const offsetIdx = activeParams.length;
            activeQueryStr += ` LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
        }
        
        const activePayload = activeQueryStr
            ? await fetchWithCache(
                adminCacheKey('active-properties', req.session.user.role, {
                    tab: activeTab,
                    search,
                    sort,
                    page: currentPage,
                    limit,
                    ajax_active_listings: Boolean(ajax_active_listings)
                }),
                15,
                async () => {
                    const [rows, countRows] = await Promise.all([
                        pool.query(activeQueryStr, activeParams),
                        activeCountQuery ? pool.query(activeCountQuery, activeCountParams) : Promise.resolve({ rows: [{ total: 0 }] })
                    ]);
                    return {
                        rows: rows.rows,
                        total: parseInt(countRows.rows[0]?.total || '0', 10)
                    };
                }
            )
            : { rows: [], total: 0 };
        const activeTotal = parseInt(activePayload.total || 0, 10);
        const activePagination = {
            total: activeTotal,
            page: currentPage,
            totalPages: Math.max(1, Math.ceil(activeTotal / limit)),
            limit
        };

        if (ajax_active_listings) return res.json({ active: can('manage_properties') ? activePayload.rows : [], pagination: activePagination });
        
        let team = [];
        if (can('manage_team') && needsTeam) {
            const teamRes = await pool.query("SELECT id, username, email, phone, role, created_at FROM users WHERE role = 'support' AND username != 'Saksh'");
            team = teamRes.rows;
        }

        const uPage = parseInt(users_page) || 1;
        const usersRes = can('view_users') && needsUsers ? await pool.query("SELECT id, username, name, email, phone, role, parent_id, sales_agent_type, parent_type, created_at, is_active, account_number, agency_name, corporate_type, gst_number, rera_number, avatar_url, company_logo FROM users WHERE username != 'Saksh' ORDER BY created_at DESC LIMIT 50 OFFSET $1", [(uPage - 1) * 50]) : { rows: [] };
        const users = usersRes.rows;

        const tenantsRes = can('manage_visits') && needsVisits ? await pool.query("SELECT id, username, email FROM users WHERE role IN ('tenant', 'owner') ORDER BY created_at DESC LIMIT 200") : { rows: [] };
        const tenantsList = tenantsRes.rows;

        const chatsRes = can('view_messages') && needsMessages ? await pool.query(`
            SELECT p.id, p.title, pc.last_message, pc.id as conversation_id, pc.last_message_at as created_at,
                   u_buyer.username as sender_username
            FROM property_conversations pc
            JOIN properties p ON pc.property_id = p.id
            JOIN users u_buyer ON pc.buyer_id = u_buyer.id
            ORDER BY pc.last_message_at DESC
            LIMIT 100
        `) : null;
        const chats = chatsRes ? chatsRes.rows : [];

        const vPage = parseInt(visits_page) || 1;
        const visitsRes = can('manage_visits') && needsVisits ? await pool.query(`
            SELECT v.*, p.title as property_title, p.photos, u.username as renter_name, u.phone as renter_phone,
                   a.username as agent_name, parent.username as parent_name
            FROM visits v
            JOIN properties p ON v.property_id = p.id
            JOIN users u ON v.user_id = u.id
            LEFT JOIN users a ON v.agent_id = a.id
            LEFT JOIN users parent ON a.parent_id = parent.id
            ORDER BY v.scheduled_at DESC
            LIMIT 50 OFFSET $1
        `, [(vPage - 1) * 50]) : null;
        const visits = visitsRes ? visitsRes.rows : [];

        const assignedVisitsRes = can('manage_visits') && needsVisits ? await pool.query(`
            SELECT v.*, p.title as property_title, p.photos, u.username as renter_name, u.phone as renter_phone,
                   a.username as agent_name, parent.username as parent_name
            FROM visits v
            JOIN properties p ON v.property_id = p.id
            JOIN users u ON v.user_id = u.id
            LEFT JOIN users a ON v.agent_id = a.id
            LEFT JOIN users parent ON a.parent_id = parent.id
            WHERE v.agent_id IS NOT NULL
            ORDER BY v.scheduled_at DESC
            LIMIT 100
        `) : { rows: [] };
        const assignedVisitsList = assignedVisitsRes.rows;
        const kycRes = can('manage_kyc') && needsKyc ? await pool.query(`
            SELECT u.id, u.username, u.email, u.phone, u.agency_name, k.doc_type, k.file_path, k.document_number
            FROM users u 
            JOIN kyc_docs k ON u.id = k.user_id 
            WHERE k.status = 'pending'
        `) : { rows: [] };
        const kycMap = {};
        kycRes.rows.forEach(r => {
            if(!kycMap[r.id]) kycMap[r.id] = { id: r.id, username: r.username, email: r.email, phone: r.phone, docs: [] };
            kycMap[r.id].docs.push({ type: r.doc_type, file: r.file_path, agency: r.agency_name, number: r.document_number });
        });
        const kycPending = Object.values(kycMap);

        const dealers = can('view_users') && needsUsers ? await pool.query("SELECT * FROM users WHERE role = 'dealer'") : { rows: [] };
        const botResponses = can('manage_bot') && needsBot ? await BotService.getResponses() : [];
        const assignableAgentsRes = can('manage_sales') && needsSales ? await pool.query(`
            SELECT users.id, users.username, users.email, users.account_number, users.role, users.parent_id, users.sales_agent_type, users.parent_type,
                   parent.username as parent_name,
                   (SELECT AVG(rating) FROM user_reviews WHERE target_user_id = users.id) as rating,
                   (SELECT COUNT(id) FROM user_reviews WHERE target_user_id = users.id) as review_count
            FROM users 
            LEFT JOIN users parent ON users.parent_id = parent.id
            WHERE users.role IN ('broker', 'external_sales')
            ORDER BY users.username ASC
        `) : { rows: [] };
        const assignableAgents = assignableAgentsRes.rows;

        const allLeadsRes = can('manage_sales') && needsSales ? await pool.query(`
            SELECT l.*, u.username as agent_name 
            FROM leads l 
            LEFT JOIN users u ON l.agent_id = u.id 
            ORDER BY l.created_at DESC
        `) : { rows: [] };
        const allLeads = allLeadsRes.rows;

        const pendingCorporate = can('manage_corporate') && needsCorporate ? await pool.query("SELECT * FROM users WHERE role = 'corporate' AND is_domain_approved = FALSE") : { rows: [] };

        const referralsRes = can('manage_referrals') && needsReferrals ? await pool.query(`SELECT r.*, u1.name as referrer_name, u1.role as referrer_role, u2.name as referred_name, u2.role as referred_role FROM referrals r JOIN users u1 ON r.referrer_id = u1.id JOIN users u2 ON r.referred_user_id = u2.id ORDER BY r.created_at DESC`) : { rows: [] };
        const referralsList = referralsRes.rows;
        const withdrawalsRes = can('manage_referrals') && needsReferrals ? await pool.query(`SELECT w.*, u.name, u.account_number, u.email FROM withdrawals w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC`) : { rows: [] };
        const withdrawalsList = withdrawalsRes.rows;
        const contactMessagesRes = can('view_users') && needsContact ? await pool.query(`
            SELECT id, name, email, phone, topic, message, created_at
            FROM contact_messages
            ORDER BY created_at DESC
            LIMIT 500
        `).catch(() => ({ rows: [] })) : { rows: [] };
        const contactMessages = contactMessagesRes.rows;
        const issueReportsRes = can('view_users') && needsContact ? await pool.query(`
            SELECT r.id, r.user_id, r.reported_username, r.reason, r.description, r.status, r.created_at,
                   u.username AS reporter_username, u.email AS reporter_email
            FROM reports r
            LEFT JOIN users u ON u.id = r.user_id
            ORDER BY r.created_at DESC
            LIMIT 500
        `).catch(() => ({ rows: [] })) : { rows: [] };
        const issueReports = issueReportsRes.rows;

        const referralStatsRes = can('manage_referrals') && needsReferrals ? await pool.query(`
            SELECT 
                COUNT(*) as total_referrals,
                SUM(CASE WHEN referral_type = 'partner' THEN 1 ELSE 0 END) as partner_referrals,
                SUM(CASE WHEN referral_type = 'user' THEN 1 ELSE 0 END) as user_referrals,
                SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid
            FROM referrals
        `) : { rows: [{}] };
        const referralStats = referralStatsRes.rows[0] || {};

        // Fetch permissions for the UI anywhere the admin quick-actions panel may render.
        const permsRes = needsPermissionData ? await pool.query("SELECT * FROM permissions ORDER BY id ASC").catch(() => ({ rows: [] })) : { rows: [] };
        const allPermissions = permsRes.rows;

        const rolePermsRes = needsPermissionData ? await pool.query("SELECT * FROM role_permissions").catch(() => ({ rows: [] })) : { rows: [] };
        const rolePermissions = rolePermsRes.rows;

        const userPermsRes = needsPermissionData ? await pool.query("SELECT * FROM user_permissions").catch(() => ({ rows: [] })) : { rows: [] };
        const userPermissions = userPermsRes.rows;

        let corporateClients = [];
        let rmList = [];
        let corporateRequirements = [];
        let pendingSuggestions = [];

        if (can('manage_corporate') && needsCorporate) {
            const corpRes = await pool.query(`
                SELECT c.id, c.username, c.agency_name, c.email, c.phone, c.account_number, c.is_domain_approved, c.company_logo, c.avatar_url, rm.username as rm_name, c.rm_id, c.created_at
                FROM users c
                LEFT JOIN users rm ON c.rm_id = rm.id
                WHERE c.role = 'corporate'
            `);
            corporateClients = corpRes.rows;
            
            const rmRes = await pool.query("SELECT id, username, role FROM users WHERE role IN ('admin', 'support', 'external_sales', 'broker') AND username != 'Saksh' ORDER BY username ASC");
            rmList = rmRes.rows;
            
            const reqRes = await pool.query(`
                SELECT cr.*, u.agency_name, u.username as corp_name 
                FROM corporate_requirements cr 
                JOIN users u ON cr.corporate_id = u.id 
                ORDER BY cr.created_at DESC
            `);
            corporateRequirements = reqRes.rows;
            
            try {
                const suggRes = await pool.query(`
                    SELECT rs.*, p.title as property_title, p.locality, p.final_price, p.type, p.photos, cr.cities as req_cities, cr.property_type as req_type, u.username as suggested_by_name, c.username as corporate_name
                    FROM requirement_suggestions rs
                    JOIN properties p ON rs.property_id = p.id
                    JOIN corporate_requirements cr ON rs.requirement_id = cr.id
                    JOIN users c ON cr.corporate_id = c.id
                    LEFT JOIN users u ON rs.suggested_by = u.id
                    WHERE rs.status = 'pending'
                    ORDER BY rs.created_at DESC
                `);
                pendingSuggestions = suggRes.rows;
            } catch(e) {}
        } else if (req.session.user.role === 'support' && can('manage_corporate') && needsCorporate) { // Support can only see their assigned clients
            const corpRes = await pool.query(`
                SELECT c.id, c.username, c.agency_name, c.email, c.phone, c.account_number, c.is_domain_approved, c.company_logo, c.avatar_url, rm.username as rm_name, c.rm_id, c.created_at
                FROM users c
                LEFT JOIN users rm ON c.rm_id = rm.id
                WHERE c.role = 'corporate' AND c.rm_id = $1
            `, [req.session.user.id]);
            corporateClients = corpRes.rows;

            const reqRes = await pool.query(`
                SELECT cr.*, u.agency_name, u.username as corp_name 
                FROM corporate_requirements cr 
                JOIN users u ON cr.corporate_id = u.id 
                WHERE u.rm_id = $1
                ORDER BY cr.created_at DESC
            `, [req.session.user.id]);
            corporateRequirements = reqRes.rows;

            try {
                const suggRes = await pool.query(`
                    SELECT rs.*, p.title as property_title, p.locality, p.final_price, p.type, p.photos, cr.cities as req_cities, cr.property_type as req_type, u.username as suggested_by_name, c.username as corporate_name
                    FROM requirement_suggestions rs
                    JOIN properties p ON rs.property_id = p.id
                    JOIN corporate_requirements cr ON rs.requirement_id = cr.id
                    JOIN users c ON cr.corporate_id = c.id
                    LEFT JOIN users u ON rs.suggested_by = u.id
                    WHERE rs.status = 'pending' AND c.rm_id = $1
                    ORDER BY rs.created_at DESC
                `, [req.session.user.id]);
                pendingSuggestions = suggRes.rows;
            } catch(e) {}
        }

        // Fetch recent messages for active properties
        const activeIds = isOverviewTab ? activePayload.rows.map(p => p.id) : [];
        let allConversations = [];
        if (activeIds.length > 0) {
            allConversations = await cachedRows(
                adminCacheKey('active-conversations', req.session.user.role, { ids: activeIds.join(',') }),
                15,
                `
                    SELECT pc.*, u_buyer.username as buyer_username
                    FROM property_conversations pc
                    JOIN users u_buyer ON pc.buyer_id = u_buyer.id
                    WHERE pc.property_id = ANY($1::int[])
                `,
                [activeIds]
            );
        }

        for (let p of activePayload.rows) {
            const propConvs = allConversations.filter(c => c.property_id === p.id);
            p.inquiry_count = propConvs.length;
            p.threads = {};
            propConvs.forEach(c => {
                p.threads[c.buyer_username] = [{ content: c.last_message, created_at: c.last_message_at }];
            });
        }
        
        const payload = { 
            user: req.session.user,
            pending: pendingRows, visitReports: visitReportRows, verified: verifiedRows, active: activePayload.rows,
            team: maskSupportRows(team),
            users: maskSupportRows(users),
            tenantsList: maskSupportRows(tenantsList),
            chats: maskSupportRows(chats),
            visits: maskSupportRows(visits),
            assignedVisitsList: maskSupportRows(assignedVisitsList),
            kycPending: maskSupportRows(kycPending),
            dealers: maskSupportRows(dealers.rows),
            botResponses,
            assignableAgents: maskSupportRows(assignableAgents),
            allLeads: maskSupportRows(allLeads),
            pendingCorporate: maskSupportRows(pendingCorporate.rows),
            corporateClients: maskSupportRows(corporateClients),
            rmList: maskSupportRows(rmList),
            corporateRequirements,
            pendingSuggestions,
            effectivePermissions,
            allPermissions, rolePermissions, userPermissions,
            referralsList: maskSupportRows(referralsList),
            withdrawalsList: maskSupportRows(withdrawalsList),
            contactMessages: maskSupportRows(contactMessages),
            issueReports: maskSupportRows(issueReports),
            referralStats,
            query: req.query, tab: req.query.tab || 'overview',
            isSupport
        };

        if (wantsJson) return res.json(payload);
        
        res.render('admin-dashboard', { ...payload, maskEmail, maskPhone });
    });
    
    // Admin Updates
    router.post('/update', upload.fields([{ name: 'photos', maxCount: 20 }, { name: 'model', maxCount: 1 }]), hasPermission('manage_properties'), async (req, res) => {
        const { id, status, estimated_min, estimated_max, final_price, infra_plan, locality, size, condition, lat, lng, latitude, longitude, type, typeOther } = req.body;
        const finalType = type === 'Others' ? typeOther : type;
        let photoFiles = (req.files && req.files['photos']) ? req.files['photos'].map(f => f.key || f.filename) : [];
        let modelFile = (req.files && req.files['model']) ? (req.files['model'][0].key || req.files['model'][0].filename) : null;
        
        const propRes = await pool.query('SELECT * FROM properties WHERE id = $1', [id]);
        if (propRes.rows.length === 0) return res.redirect('/admin');
        const currentProp = propRes.rows[0];
        const updatedPhotos = (currentProp.photos || []).concat(photoFiles);

        if (photoFiles.length > 0) await pool.query(`UPDATE properties SET photos = $1 WHERE id = $2`, [updatedPhotos, id]);
        if (modelFile) await pool.query(`UPDATE properties SET model_path = $1 WHERE id = $2`, [modelFile, id]);
        
        const verification_status = req.body.verification_status || currentProp.verification_status;
        const verification_notes = req.body.verification_notes || currentProp.verification_notes;
        let verified_by = currentProp.verified_by;
        let verified_at = currentProp.verified_at;

        if (req.body.verification_status && req.body.verification_status !== currentProp.verification_status) {
            verified_by = req.session.user.id;
            verified_at = new Date();
        }
        const is_matrix_verified = verification_status === 'Verified' || verification_status === 'Premium Verified';
        
        if (status === 'verified' && updatedPhotos.length < 4) {
            return res.send('<script>alert("Error: At least 4 photos are required to raise a request for active listing."); window.history.back();</script>');
        }

        let listedAtQueryPart = "";
        if (status === 'listed' && currentProp.status !== 'listed') {
            listedAtQueryPart = ", listed_at = NOW()";
        }

        let finalStatus = status || currentProp.status;
        if (verification_status === 'Rejected') finalStatus = 'unlisted';
        const coordinates = normalizeSubmittedCoordinates(lat, lng, latitude, longitude);

        await pool.query(`UPDATE properties SET 
            status=$1, estimated_min=$2, estimated_max=$3, final_price=$4, infra_plan=$5, 
            locality=$6, is_matrix_verified=$7, size=$8, condition=$9, latitude=$10, 
            longitude=$11, type=$12, verification_status=$13, verification_notes=$14, verified_by=$15, verified_at=$16 ${listedAtQueryPart} WHERE id=$17`, 
            [
                finalStatus, estimated_min || currentProp.estimated_min, estimated_max || currentProp.estimated_max,
                final_price || currentProp.final_price, infra_plan || currentProp.infra_plan, locality || currentProp.locality,
                is_matrix_verified !== undefined ? !!is_matrix_verified : currentProp.is_matrix_verified, size || currentProp.size,
                condition || currentProp.condition, coordinates ? coordinates.lat : currentProp.latitude,
                coordinates ? coordinates.lng : currentProp.longitude, finalType || currentProp.type,
                verification_status, verification_notes, verified_by, verified_at, id
            ]
        );

        // Invalidate the homepage cache so users see the updated property immediately
        await invalidateCache('public_properties');

        try {
            const prop = await pool.query(`SELECT p.title, p.locality, u.email, u.phone, u.name, u.username FROM properties p JOIN users u ON p.owner_id = u.id WHERE p.id = $1`, [id]);
            if (prop.rows.length > 0) {
                const pInfo = prop.rows[0];
                const propertyTitle = pInfo.title;
                
                // Queue the owner notification
                await emailQueue.add('statusUpdateEmail', { email: pInfo.email, propertyTitle, status, propertyId: id });

                // Send WhatsApp Status Update
                if (pInfo.phone) {
                    const ownerName = pInfo.name || pInfo.username;
                    waService.sendPropertyStatusUpdate(pInfo.phone, ownerName, pInfo.locality || 'your property', status).catch(e => console.error('WA Error:', e));
                    
                    if (status === 'listed') {
                        waService.sendListingUpdate(pInfo.phone, ownerName).catch(e => console.error('WA Error:', e));
                    }
                }

                const wishlistUsers = await pool.query(`SELECT u.email, u.username FROM favorites f JOIN users u ON f.user_id = u.id WHERE f.property_id = $1`, [id]);
                for (const user of wishlistUsers.rows) {
                    // Queue all wishlist notifications instantly
                    await emailQueue.add('wishlistUpdateEmail', { email: user.email, username: user.username, propertyTitle, status, propertyId: id, host: req.headers.host });
                }
            }
        } catch (e) { console.log("Email error", e); }
        res.redirect('/admin');
    });

    router.post('/property/:id/update-status', hasPermission('manage_properties'), async (req, res) => {
        try {
            const result = await pool.query('SELECT status FROM properties WHERE id = $1', [req.params.id]);
            if (result.rows.length > 0) {
                const status = result.rows[0].status;
                const newStatus = status === 'listed' ? 'unlisted' : (status === 'unlisted' ? 'listed' : status);
                if (newStatus !== status) {
                    await pool.query('UPDATE properties SET status = $1 WHERE id = $2', [newStatus, req.params.id]);
                    await invalidateCache('public_properties');
                }
            }
        } catch (err) { console.error("Toggle status error:", err); }
        res.redirect('/admin');
    });

    router.post('/property/:id/verify-status', hasPermission('manage_properties'), async (req, res) => {
        try {
            const { verification_status } = req.body;
            const isVerified = verification_status === 'Verified' || verification_status === 'Premium Verified';
            
            let statusUpdateQuery = '';
            if (verification_status === 'Rejected') {
                statusUpdateQuery = ", status = 'unlisted'";
            } else if (isVerified) {
                statusUpdateQuery = ", status = 'listed'";
            }
            
            await pool.query(`UPDATE properties SET verification_status = $1, verified_by = $2, verified_at = NOW(), is_matrix_verified = $3 ${statusUpdateQuery} WHERE id = $4`, 
                [verification_status, req.session.user.id, isVerified, req.params.id]);
            await invalidateCache('public_properties');
        } catch (err) { console.error("Verify status update error:", err); }
        res.redirect('/admin');
    });

    // Team & User Management
    router.post('/team/add', hasPermission('manage_team'), async (req, res) => {
        const name = req.body.name || req.body.username;
        const { email, password, phone, role } = req.body;
        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.redirect('/admin?tab=team&error=' + encodeURIComponent("Error creating team member: " + passwordError));
        }
        const hash = await bcrypt.hash(password, 10);
        const uniqueUsername = await generateUniqueUsername(name);

        if (RESERVED_USERNAMES.has(uniqueUsername.toLowerCase())) {
            return res.redirect('/admin?tab=team&error=' + encodeURIComponent('This username is reserved and cannot be used.'));
        }

        try {
            if (!['support', 'admin', 'external_sales'].includes(role)) throw new Error("Invalid team role selected.");
            
            let nextAccountNumber;
            const resAcc = await pool.query(`SELECT MAX(CAST(account_number AS INTEGER)) as max_acc FROM users WHERE role ${role === 'admin' ? '=' : '!='} 'admin' AND account_number ~ '^[0-9]{${role === 'admin' ? '4' : '7'}}$'`);
            nextAccountNumber = (resAcc.rows[0].max_acc || (role === 'admin' ? 1000 : 1000000)) + 1;

            const salesAgentType = role === 'external_sales' ? 'independent' : null;
            const result = await pool.query('INSERT INTO users (name, username, account_number, email, password_hash, role, phone, sales_agent_type, parent_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL) RETURNING id', [name, uniqueUsername, nextAccountNumber.toString(), email, hash, role, phone, salesAgentType]);
            await addToPasswordHistory(result.rows[0].id, hash);
            await invalidateUserPermissionCache(result.rows[0].id);
            
            if (phone) {
                const loginUrl = `http://${req.headers.host}/login`;
                waService.sendAccountCredentials(phone, name, uniqueUsername, email, password, loginUrl).catch(e => console.error("WA Error:", e));
            }
            const loginUrl = `http://${req.headers.host}/login`;
            await emailQueue.add('accountCredentialsEmail', { email, name, username: uniqueUsername, password, loginUrl });
            
            res.redirect('/admin?tab=team&message=Team+member+added');
        } catch (err) {
            console.error("Error creating team member:", err);
            const errorMessage = err.code === '23505' ? 'A user with that username or email already exists.' : err.message;
            res.redirect('/admin?tab=team&error=' + encodeURIComponent(errorMessage));
        }
    });

    router.post('/user/create-special', hasPermission('manage_users'), async (req, res) => {
        const name = req.body.name || req.body.username;
        const { email, password, phone, role, agency_name, corporate_type, parent_id } = req.body;
        const crypto = require('crypto');
        
        // Generate a secure random password if left blank by the admin
        const finalPassword = password || (crypto.randomBytes(6).toString('hex') + 'A1!');
        const hash = await bcrypt.hash(finalPassword, 10);
        const uniqueUsername = await generateUniqueUsername(name);

        if (RESERVED_USERNAMES.has(uniqueUsername.toLowerCase())) {
            return res.redirect('/admin?error=This username is reserved and cannot be used.');
        }
        
        let nextAccountNumber;
        const resAcc = await pool.query("SELECT MAX(CAST(account_number AS INTEGER)) as max_acc FROM users WHERE role != 'admin' AND account_number ~ '^[0-9]{7}$'");
        nextAccountNumber = (resAcc.rows[0].max_acc || 1000000) + 1;

        try {
            let salesAgentType = null;
            let parentType = null;
            if (role === 'external_sales') {
                salesAgentType = parent_id ? 'associated' : 'independent';
                if (parent_id) {
                    const parentRes = await pool.query("SELECT role FROM users WHERE id = $1 AND role IN ('broker', 'builder')", [parent_id]);
                    parentType = parentRes.rows[0]?.role || null;
                }
            }
            const newUser = await pool.query(
                'INSERT INTO users (name, username, account_number, email, password_hash, role, phone, agency_name, corporate_type, is_email_verified, is_domain_approved, has_random_password, parent_id, sales_agent_type, parent_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, TRUE, $10, $11, $12, $13) RETURNING id',
                [name, uniqueUsername, nextAccountNumber.toString(), email, hash, role, phone, agency_name || null, corporate_type || null, !password, parent_id || null, salesAgentType, parentType]
            );
            await addToPasswordHistory(newUser.rows[0].id, hash);
            await invalidateUserPermissionCache(newUser.rows[0].id);

            const loginUrl = `http://${req.headers.host}/login`;
            if (phone) { waService.sendAccountCredentials(phone, name, uniqueUsername, email, finalPassword, loginUrl).catch(e => console.error("WA Error:", e)); }
            await emailQueue.add('accountCredentialsEmail', { email, name, username: uniqueUsername, password: finalPassword, loginUrl });

            res.redirect('/admin');
        } catch (err) { console.error("Error creating user:", err); res.redirect('/admin?error=Failed+to+create+user'); }
    });

    router.post('/user/toggle-status', hasPermission('manage_users'), async (req, res) => {
        const { id, is_active } = req.body;
        try {
            const check = await pool.query("SELECT username FROM users WHERE id = $1", [id]);
            if (check.rows.length > 0 && check.rows[0].username === 'Saksh') {
                return res.redirect('/admin?tab=users&error=' + encodeURIComponent('Cannot disable the system bot.'));
            }
            await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active === 'true', id]);
            await invalidateUserPermissionCache(id);
        } catch (err) { console.error("Toggle user status error:", err); }
        res.redirect('/admin?tab=users');
    });

    router.post('/user/update-role', hasPermission('manage_users'), async (req, res) => {
        const { id, role } = req.body;
        try {
            const check = await pool.query("SELECT username FROM users WHERE id = $1", [id]);
            if (check.rows.length > 0 && check.rows[0].username === 'Saksh') {
                return res.redirect('/admin?tab=users&error=' + encodeURIComponent('Cannot change the role of the system bot.'));
            }
            await pool.query(`
                UPDATE users
                SET role = $1,
                    sales_agent_type = CASE
                        WHEN $1 = 'external_sales' AND parent_id IS NULL THEN 'independent'
                        WHEN $1 = 'external_sales' THEN 'associated'
                        ELSE NULL
                    END,
                    parent_type = CASE
                        WHEN $1 = 'external_sales' AND parent_id IS NOT NULL THEN (SELECT role FROM users parent WHERE parent.id = users.parent_id)
                        ELSE NULL
                    END
                WHERE id = $2
            `, [role, id]);
            await invalidateUserPermissionCache(id);
        } catch (err) { console.error("Update role error:", err); }
        res.redirect('/admin?tab=users');
    });

    router.post('/user/edit', hasPermission('manage_users'), async (req, res) => {
        const { id, name, email, phone, role, agency_name, gst_number, rera_number } = req.body;
        try {
            const check = await pool.query("SELECT username FROM users WHERE id = $1", [id]);
            if (check.rows.length > 0 && check.rows[0].username === 'Saksh') {
                return res.redirect('/admin?tab=users&error=' + encodeURIComponent('Cannot edit the system bot.'));
            }
            await pool.query(
                `UPDATE users
                 SET name = $1,
                     email = $2,
                     phone = $3,
                     role = $4,
                     agency_name = $5,
                     gst_number = $6,
                     rera_number = $7,
                     sales_agent_type = CASE
                         WHEN $4 = 'external_sales' AND parent_id IS NULL THEN 'independent'
                         WHEN $4 = 'external_sales' THEN 'associated'
                         ELSE NULL
                     END,
                     parent_type = CASE
                         WHEN $4 = 'external_sales' AND parent_id IS NOT NULL THEN (SELECT role FROM users parent WHERE parent.id = users.parent_id)
                         ELSE NULL
                     END
                 WHERE id = $8`,
                [name, email, phone, role, agency_name || null, gst_number || null, rera_number || null, id]
            );
            await invalidateUserPermissionCache(id);
            res.redirect('/admin?tab=users&message=User+updated+successfully');
        } catch (err) {
            console.error("Edit user error:", err);
            res.redirect('/admin?tab=users&error=Failed+to+update+user');
        }
    });

    router.post('/user/delete', hasPermission('manage_users'), async (req, res) => {
        const targetId = req.body.id;
        try {
            if (req.session.user.role !== 'admin') {
                const check = await pool.query('SELECT id FROM users WHERE id = $1 AND parent_id = $2', [targetId, req.session.user.id]);
                if (check.rows.length === 0) return res.status(403).send('Unauthorized to delete this user.');
            }
            
            // Fetch user info for logging before deleting
            const userToDel = await pool.query('SELECT username, email, role FROM users WHERE id = $1', [targetId]);
            let delDetails = `Deleted user ID: ${targetId}`;
            if (userToDel.rows.length > 0) {
                const u = userToDel.rows[0];
                if (u.username === 'Saksh') {
                    return res.redirect('/admin?tab=users&error=' + encodeURIComponent('Cannot delete the system bot.'));
                }
                delDetails = `Deleted ${u.role} '${u.username}' (${u.email}) [ID: ${targetId}]`;
                await pool.query('DELETE FROM messages WHERE sender_username = $1 OR tenant_username = $1', [u.username]).catch(() => {});
            }

            // Safely detach or delete from related tables to prevent foreign key constraint blocking
            await pool.query('UPDATE visits SET agent_id = NULL WHERE agent_id = $1', [targetId]).catch(() => {});
            await pool.query('UPDATE properties SET assigned_broker_id = NULL WHERE assigned_broker_id = $1', [targetId]).catch(() => {});
            await pool.query('UPDATE users SET parent_id = NULL WHERE parent_id = $1', [targetId]).catch(() => {});
            await pool.query('UPDATE users SET rm_id = NULL WHERE rm_id = $1', [targetId]).catch(() => {});
            await pool.query('UPDATE reports SET user_id = NULL WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('UPDATE requirement_suggestions SET suggested_by = NULL WHERE suggested_by = $1', [targetId]).catch(() => {});
            
            await pool.query('DELETE FROM user_reviews WHERE target_user_id = $1 OR reviewer_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM reviews WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM favorites WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM recently_viewed WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM vault_documents WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM vault_folders WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM kyc_docs WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM leads WHERE agent_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM dealer_leads WHERE dealer_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM agent_schedules WHERE agent_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM corporate_requirements WHERE corporate_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM withdrawals WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM referrals WHERE referrer_id = $1 OR referred_user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM notifications WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM visits WHERE user_id = $1', [targetId]).catch(() => {});
            await pool.query('DELETE FROM project_brokers WHERE broker_id = $1', [targetId]).catch(() => {});

            // Delete user's properties and their dependencies
            const props = await pool.query('SELECT id FROM properties WHERE owner_id = $1', [targetId]).catch(() => ({rows:[]}));
            const propIds = props.rows.map(p => p.id);
            if (propIds.length > 0) {
                await pool.query('DELETE FROM messages WHERE property_id = ANY($1::int[])', [propIds]).catch(() => {});
                await pool.query('DELETE FROM visits WHERE property_id = ANY($1::int[])', [propIds]).catch(() => {});
                await pool.query('DELETE FROM reviews WHERE property_id = ANY($1::int[])', [propIds]).catch(() => {});
                await pool.query('DELETE FROM favorites WHERE property_id = ANY($1::int[])', [propIds]).catch(() => {});
                await pool.query('DELETE FROM recently_viewed WHERE property_id = ANY($1::int[])', [propIds]).catch(() => {});
                await pool.query('UPDATE leads SET property_id = NULL WHERE property_id = ANY($1::int[])', [propIds]).catch(() => {});
                await pool.query('DELETE FROM requirement_suggestions WHERE property_id = ANY($1::int[])', [propIds]).catch(() => {});
                await pool.query('DELETE FROM properties WHERE owner_id = $1', [targetId]).catch(() => {});
            }

            // Delete user's projects and their dependencies
            const projs = await pool.query('SELECT id FROM projects WHERE dealer_id = $1', [targetId]).catch(() => ({rows: []}));
            const projIds = projs.rows.map(p => p.id);
            if (projIds.length > 0) {
                await pool.query('DELETE FROM inventory_units WHERE project_id = ANY($1::int[])', [projIds]).catch(() => {});
                await pool.query('DELETE FROM dealer_leads WHERE project_id = ANY($1::int[])', [projIds]).catch(() => {});
                await pool.query('DELETE FROM project_brokers WHERE project_id = ANY($1::int[])', [projIds]).catch(() => {});
                await pool.query('DELETE FROM projects WHERE dealer_id = $1', [targetId]).catch(() => {});
            }
            
            await pool.query('DELETE FROM users WHERE id = $1', [targetId]);
            await invalidateUserPermissionCache(targetId);
            
            // Log the activity
            await pool.query('INSERT INTO activity_logs (admin_id, action, details) VALUES ($1, $2, $3)', [req.session.user.id, 'DELETE_USER', delDetails]).catch(e => console.error('Activity log error:', e));
            
            res.redirect('/admin?tab=users&message=User+deleted+successfully');
        } catch (err) {
            console.error("Hard delete error:", err);
            res.redirect('/admin?tab=users&error=Delete+failed.+Database+constraints+might+prevent+this.');
        }
    });

    router.post('/corporate/approve', hasPermission('manage_corporate'), async (req, res) => {
        await pool.query('UPDATE users SET is_domain_approved = TRUE WHERE id = $1', [req.body.userId]);
        await pool.query('UPDATE users SET is_domain_approved = TRUE WHERE parent_id = $1', [req.body.userId]);
        res.redirect('/admin');
    });

    router.post('/kyc/update', hasPermission('manage_kyc'), async (req, res) => {
        try {
            await pool.query("UPDATE kyc_docs SET status = $1, rejection_reason = $2 WHERE user_id = $3 AND status = 'pending'", [req.body.status, req.body.reason || null, req.body.userId]);
        } catch (err) { console.error("KYC Update Error:", err); }
        res.redirect('/admin');
    });

    router.post('/permissions/role', hasPermission('manage_permissions'), async (req, res) => {
        const { role_name, permissions } = req.body;
        try {
            await pool.query('BEGIN');
            await pool.query('DELETE FROM role_permissions WHERE role_name = $1', [role_name]);
            const permArray = permissions ? (Array.isArray(permissions) ? permissions : [permissions]) : [];
            for (let permId of permArray) {
                await pool.query('INSERT INTO role_permissions (role_name, permission_id) VALUES ($1, $2)', [role_name, permId]);
            }
            await pool.query('COMMIT');
            await invalidateRolePermissionCache(role_name);
        } catch (err) {
            await pool.query('ROLLBACK');
            console.error("Role permission update error:", err);
        }
        res.redirect(`/admin?tab=permissions&role=${role_name}`);
    });

    router.post('/permissions/user', hasPermission('manage_permissions'), async (req, res) => {
        const { user_id, permissions } = req.body;
        try {
            await pool.query('BEGIN');
            const userRes = await pool.query('SELECT role FROM users WHERE id = $1', [user_id]);
            if (userRes.rows.length === 0) throw new Error('User not found');
            const roleName = userRes.rows[0].role;
            const rolePermsRes = await pool.query('SELECT permission_id FROM role_permissions WHERE role_name = $1', [roleName]);
            const rolePerms = rolePermsRes.rows.map(r => String(r.permission_id));
            const submittedPerms = permissions ? (Array.isArray(permissions) ? permissions : [permissions]) : [];
            await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [user_id]);
            const allPermsRes = await pool.query('SELECT id FROM permissions');
            for (let r of allPermsRes.rows) {
                const permId = String(r.id);
                const isChecked = submittedPerms.includes(permId);
                const isDefault = rolePerms.includes(permId);
                if (isChecked && !isDefault) {
                    await pool.query('INSERT INTO user_permissions (user_id, permission_id, is_granted) VALUES ($1, $2, TRUE)', [user_id, permId]);
                } else if (!isChecked && isDefault) {
                    await pool.query('INSERT INTO user_permissions (user_id, permission_id, is_granted) VALUES ($1, $2, FALSE)', [user_id, permId]);
                }
            }
            await pool.query('COMMIT');
            await invalidateUserPermissionCache(user_id);
        } catch (err) {
            await pool.query('ROLLBACK');
            console.error("User permission override error:", err);
        }
        res.redirect(`/admin?tab=permissions&user=${user_id}`);
    });

    // Sales & Visits
    router.post('/visit/status', hasPermission('manage_visits'), validate(visitStatusSchema), async (req, res) => {
        await pool.query('UPDATE visits SET status = $1 WHERE id = $2', [req.body.status, req.body.visitId]);
        if (req.body.status === 'completed') {
            const visitRes = await pool.query('SELECT user_id FROM visits WHERE id = $1', [req.body.visitId]);
            if (visitRes.rows.length > 0) {
                await pool.query("UPDATE referrals SET status = 'verified' WHERE referred_user_id = $1 AND status = 'pending'", [visitRes.rows[0].user_id]);
            }
        }
        res.redirect('/admin?tab=sales');
    });

    router.post('/visit/assign', hasPermission('manage_visits'), validate(visitAssignSchema), async (req, res) => {
        const { visitId, agent_id } = req.body;
        const visitRes = await pool.query('SELECT status FROM visits WHERE id = $1', [visitId]);
        if (visitRes.rows.length > 0) {
            let status = visitRes.rows[0].status;
            if (status !== 'completed') status = agent_id ? 'assigned' : 'pending';
            await pool.query('UPDATE visits SET agent_id = $1, status = $2 WHERE id = $3', [agent_id || null, status, visitId]);
            
            if (agent_id) {
                const vInfo = await pool.query(`
                    SELECT v.scheduled_at, u.phone as visitor_phone, u.name as visitor_name, u.username as visitor_username, u.email as visitor_email,
                           p.title, p.latitude, p.longitude,
                           a.name as agent_name, a.username as agent_uname, a.phone as agent_phone
                    FROM visits v
                    JOIN users u ON v.user_id = u.id
                    JOIN properties p ON v.property_id = p.id
                    JOIN users a ON a.id = $1
                    WHERE v.id = $2
                `, [agent_id, visitId]);

                if (vInfo.rows.length > 0) {
                    const vi = vInfo.rows[0];
                    const mapUrl = (vi.latitude && vi.longitude) ? `https://www.google.com/maps/dir/?api=1&destination=${vi.latitude},${vi.longitude}` : 'N/A';
                    const vDate = new Date(vi.scheduled_at).toLocaleDateString('en-IN');
                    const vTime = new Date(vi.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    const visitorName = vi.visitor_name || vi.visitor_username;
                    const agentName = vi.agent_name || vi.agent_uname;
                    
                    if (vi.visitor_phone) {
                        waService.sendContactUpdatedVisit(vi.visitor_phone, visitorName, vDate, vTime, agentName, vi.agent_phone || 'N/A', mapUrl).catch(e => console.error("WA Error:", e));
                    }
                    if (vi.visitor_email) {
                        const emailDetails = {
                            userName: visitorName,
                            date: vDate,
                            time: vTime,
                            agentName: agentName,
                            agentPhone: vi.agent_phone || 'N/A',
                            mapUrl: mapUrl
                        };
                        await emailQueue.add('contactUpdatedVisitEmail', { email: vi.visitor_email, visitDetails: emailDetails });
                    }
                }
            }
        }
        res.redirect('/admin?tab=sales');
    });

    router.post('/visit/create-assign', hasPermission('manage_visits'), validate(visitCreateAssignSchema), async (req, res) => {
        try {
            await pool.query('INSERT INTO visits (property_id, user_id, agent_id, scheduled_at, status, notes) VALUES ($1, $2, $3, $4, $5, $6)',
                [req.body.property_id, req.body.user_id, req.body.agent_id, req.body.scheduled_at, 'assigned', req.body.notes]);
        } catch (err) { console.error("Error creating and assigning visit:", err); }
        res.redirect('/admin?tab=sales');
    });

    router.post('/corporate/assign-rm', hasPermission('manage_corporate'), async (req, res) => {
        await pool.query('UPDATE users SET rm_id = $1 WHERE id = $2 AND role = $3', [req.body.rm_id || null, req.body.corporate_id, 'corporate']);
        res.redirect('/admin?tab=corporate');
    });

    router.post('/corporate/requirement/status', hasPermission('manage_corporate'), async (req, res) => {
        if (req.session.user.role !== 'admin') {
            const check = await pool.query(`SELECT cr.id FROM corporate_requirements cr JOIN users u ON cr.corporate_id = u.id WHERE cr.id = $1 AND u.rm_id = $2`, [req.body.req_id, req.session.user.id]);
            if (check.rows.length === 0) return res.status(403).send('Not authorized for this client.');
        }
        await pool.query('UPDATE corporate_requirements SET status = $1 WHERE id = $2', [req.body.status, req.body.req_id]);
        res.redirect(req.get('Referer') || '/admin?tab=requirements');
    });

    router.post('/requirements/delete', hasPermission('manage_corporate'), async (req, res) => {
        try {
            await pool.query('DELETE FROM corporate_requirements WHERE id = $1', [req.body.req_id]);
        } catch (err) { console.error("Error deleting requirement:", err); }
        res.redirect(req.get('Referer') || '/admin?tab=requirements');
    });

    router.post('/corporate/suggest', hasPermission('manage_corporate'), async (req, res) => {
        const { corporate_id, property_id } = req.body;
        if (req.session.user.role !== 'admin') {
            const check = await pool.query('SELECT id FROM users WHERE id = $1 AND rm_id = $2', [corporate_id, req.session.user.id]);
            if (check.rows.length === 0) return res.status(403).send('Not authorized for this client.');
        }
        if (property_id && corporate_id) {
            await pool.query('INSERT INTO favorites (user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [corporate_id, property_id]);
            await notificationService.sendNotification(corporate_id, 'Your RM has suggested a new property for your shortlist.', `/property/${property_id}`);
        }
        res.redirect(req.get('Referer') || '/admin?tab=requirements');
    });

    router.post('/corporate/suggestion/approve', hasPermission('manage_corporate'), async (req, res) => {
        const { suggestion_id } = req.body;
        try {
            const suggRes = await pool.query("UPDATE requirement_suggestions SET status = 'approved' WHERE id = $1 RETURNING requirement_id, property_id", [suggestion_id]);
            if (suggRes.rows.length > 0) {
                const { requirement_id, property_id } = suggRes.rows[0];
                const reqRes = await pool.query("SELECT corporate_id FROM corporate_requirements WHERE id = $1", [requirement_id]);
                if (reqRes.rows.length > 0) {
                    const corpId = reqRes.rows[0].corporate_id;
                    await pool.query('INSERT INTO favorites (user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [corpId, property_id]);
                    await notificationService.sendNotification(corpId, 'An admin approved a property suggestion for your requirement.', `/property/${property_id}`);
                }
            }
        } catch(e) { console.error("Error approving suggestion", e); }
        res.redirect(req.get('Referer') || '/admin?tab=requirements');
    });

    router.post('/corporate/suggestion/reject', hasPermission('manage_corporate'), async (req, res) => {
        try {
            await pool.query("UPDATE requirement_suggestions SET status = 'rejected' WHERE id = $1", [req.body.suggestion_id]);
        } catch(e) { console.error("Error rejecting suggestion", e); }
        res.redirect(req.get('Referer') || '/admin?tab=requirements');
    });

    router.post('/assign-lead', hasPermission('manage_sales'), validate(leadCreateSchema), async (req, res) => {
        const { agent_id, name, phone, email, type, preferences, property_id } = req.body;
        try {
            await pool.query('INSERT INTO leads (agent_id, name, phone, email, type, preferences, property_id, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [agent_id, name, phone, email, type, preferences, property_id || null, 'new']).catch(e => console.error(e));
        } catch (e) {
            await pool.query('INSERT INTO leads (agent_id, name, phone, email, type, preferences) VALUES ($1, $2, $3, $4, $5, $6)', [agent_id, name, phone, email, type, preferences]).catch(e => console.error(e));
        }
        res.redirect('/admin');
    });

    router.post('/update-lead-status', hasPermission('manage_sales'), validate(leadStatusSchema), async (req, res) => {
        try {
            await pool.query('UPDATE leads SET status = $1 WHERE id = $2', [req.body.status, req.body.leadId]);
        } catch (e) { console.error("Error updating lead status:", e); }
        res.redirect('/admin?tab=sales');
    });

    router.post('/delete-lead', hasPermission('manage_sales'), validate(leadDeleteSchema), async (req, res) => {
        await pool.query('DELETE FROM leads WHERE id = $1', [req.body.id]);
        res.redirect('/admin?tab=sales');
    });

    // Referral Payment Management
    router.post('/referral/pay', hasPermission('manage_referrals'), adminReferralController.payReferral);

    router.post('/referral/withdrawal/status', hasPermission('manage_referrals'), async (req, res) => {
        return adminReferralController.updateWithdrawalStatus(req, res);
        const { withdrawal_id, status } = req.body;
        try {
            await pool.query('BEGIN');
            const wRes = await pool.query("SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending'", [withdrawal_id]);
            if (wRes.rows.length > 0) {
                const withdrawal = wRes.rows[0];
                await pool.query('UPDATE withdrawals SET status = $1 WHERE id = $2', [status, withdrawal_id]);
                if (status === 'rejected') {
                    // Refund the wallet balance if rejected
                    await pool.query('UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2', [withdrawal.amount, withdrawal.user_id]);
                    await notificationService.sendNotification(withdrawal.user_id, `Your withdrawal of ₹${withdrawal.amount} has been rejected. The amount has been returned to your wallet.`, '/wallet');
                } else if (status === 'approved') {
                    await notificationService.sendNotification(withdrawal.user_id, `Your withdrawal of ₹${withdrawal.amount} has been approved and is being processed.`, '/wallet');
                }
            }
            await pool.query('COMMIT');
        } catch (e) {
            await pool.query('ROLLBACK');
            console.error("Withdrawal status update error:", e);
        }
        res.redirect('/admin?tab=referrals');
    });

    router.get('/export/pending-withdrawals', hasPermission('manage_referrals'), async (req, res) => {
        return adminReferralController.exportPendingWithdrawals(req, res);
        try {
            const pendingRes = await pool.query(`SELECT w.id, u.name, u.email, u.phone, w.amount, w.payment_details, w.created_at FROM withdrawals w JOIN users u ON w.user_id = u.id WHERE w.status = 'pending' ORDER BY w.created_at ASC`);
            if (pendingRes.rows.length === 0) return res.status(404).send("No pending withdrawals to export.");

            const fields = ['id', 'name', 'email', 'phone', 'amount', 'payment_details', 'created_at'];
            const csvRows = [fields.join(',')];
            for (const row of pendingRes.rows) {
                const values = fields.map(field => `"${String(row[field] || '').replace(/"/g, '""')}"`);
                csvRows.push(values.join(','));
            }
            res.header('Content-Type', 'text/csv');
            res.attachment('pending-withdrawals.csv');
            res.send(csvRows.join('\n'));
        } catch (err) {
            console.error("Error exporting withdrawals:", err);
            res.status(500).send("Error exporting data.");
        }
    });

    router.get('/export/users', adminPolicy.requireAdmin, hasPermission('view_users'), async (req, res) => {
        try {
            const usersRes = await pool.query(`
                SELECT id, username, name, email, phone, role, created_at, is_active, agency_name, corporate_type, gst_number, rera_number 
                FROM users 
                WHERE username != 'Saksh'
                ORDER BY created_at DESC
            `);
            if (usersRes.rows.length === 0) return res.status(404).send("No users to export.");

            const fields = ['id', 'username', 'name', 'email', 'phone', 'role', 'created_at', 'is_active', 'agency_name', 'corporate_type', 'gst_number', 'rera_number'];
            const csvRows = [fields.join(',')];
            for (const row of usersRes.rows) {
                const values = fields.map(field => {
                    let val = row[field];
                    if (val === null || val === undefined) val = '';
                    if (val instanceof Date) val = val.toISOString();
                    return `"${String(val).replace(/"/g, '""')}"`;
                });
                csvRows.push(values.join(','));
            }
            res.header('Content-Type', 'text/csv');
            res.attachment('users-export.csv');
            res.send(csvRows.join('\n'));
        } catch (err) {
            console.error("Error exporting users:", err);
            res.status(500).send("Error exporting data.");
        }
    });

    // Bot Management
    router.post('/bot/add', hasPermission('manage_bot'), async (req, res) => {
        await BotService.addResponse(req.body.trigger, req.body.response);
        res.redirect('/admin');
    });

    router.post('/bot/update', hasPermission('manage_bot'), async (req, res) => {
        await BotService.updateResponse(req.body.id, req.body.trigger, req.body.response);
        res.redirect('/admin');
    });

    router.post('/bot/delete', hasPermission('manage_bot'), async (req, res) => {
        await BotService.deleteResponse(req.body.id);
        res.redirect('/admin');
    });

    router.get('/mark-chats-read', hasPermission('view_messages'), async (req, res) => {
        const isAjax = req.headers.accept && req.headers.accept.includes('application/json');
        try {
            await pool.query("UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND link LIKE '/property/%' AND (content LIKE 'New message%' OR content LIKE 'New reply%')", [req.session.user.id]);
            await notificationService.updateUnreadCount(req.session.user.id);
            if (isAjax) return res.sendStatus(200);
        } catch (err) { console.error("Mark read error:", err); if (isAjax) return res.status(500).send('Server Error'); }
        res.redirect('/admin');
    });

    router.get('/kyc-file/*filename', hasPermission('manage_kyc'), (req, res) => {
        let filename = req.params.filename || req.params[0] || ''; 
        if (Array.isArray(filename)) filename = filename.join('/');
        
        if (filename.startsWith('kyc/')) {
            const s3BaseUrl = process.env.AWS_S3_BUCKET_NAME ? `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/` : '/uploads/';
            return res.redirect(s3BaseUrl + filename);
        }
        
        const filePath = path.join(__dirname, 'kyc_uploads', filename);
        if (fs.existsSync(filePath)) res.sendFile(filePath);
        else res.status(404).send('File not found');
    });

    return router;
};
