const express = require('express');
const pool = require('./db');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
// const multiavatar = require('@multiavatar/multiavatar'); // Removed as it's not used for avatar generation anymore
const { validatePassword, isPasswordReused, addToPasswordHistory, generateUniqueUsername } = require('./utils');
const validate = require('./validate');
const { fetchWithCache } = require('./redis-cache');
const { getUserPermissions, invalidateUserPermissionCache } = require('./permission-utils');
const { emailQueue } = require('./email-queue');
const notificationService = require('./notification-service');
const { success, error } = require('./responseHandler');
const waService = require('./whatsappService');
const { getSalesAgentContext, salesAgentInsertFields } = require('./sales-agent-utils');
const { getSalesScopeIds } = require('./sales-workflow-utils');
const { authorize, loadAuthorizationSubject } = require('./services/authorization');
const { syncPropertyAssignmentsForProperty } = require('./property-assignment-service');
const salesManagementController = require('./controllers/sales-management-controller');
const workManagementController = require('./controllers/work-management-controller');
const corporateWorkflowController = require('./controllers/corporate-workflow-controller');
const {
    leadCreateSchema,
    leadReassignSchema,
    leadStatusSchema,
    visitAssignSchema,
    visitCreateAssignSchema,
    visitManageSchema,
    visitScheduleSchema,
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

const getS3BaseUrl = () => process.env.AWS_S3_BUCKET_NAME ? `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/` : 'https://matrixspaces-uploads-590184011565-ap-south-1-an.s3.ap-south-1.amazonaws.com/';
const PROPERTY_OWNERSHIP_SELF = 'self_owned';
const PROPERTY_OWNERSHIP_MANAGED = new Set(['managed', 'managed_for_owner', 'broker_managed', 'sales_managed']);
const ACTIVE_PROPERTY_STATUSES = new Set(['listed', 'reviewing', 'negotiating', 'verified']);

function normalizePropertyOwnershipType(property) {
    return String(property && property.ownership_type || '').trim().toLowerCase();
}

function isSelfOwnedProperty(property, userId) {
    const ownershipType = normalizePropertyOwnershipType(property);
    if (ownershipType === PROPERTY_OWNERSHIP_SELF) {
        return Number(property.owner_id) === Number(userId);
    }
    return !ownershipType && Number(property.owner_id) === Number(userId) && !property.assigned_broker_id;
}

function classifyDashboardProperties(properties, userId) {
    const myProperties = [];
    const managedProperties = [];

    for (const property of properties) {
        if (isSelfOwnedProperty(property, userId)) {
            myProperties.push(property);
        } else {
            managedProperties.push(property);
        }
    }

    return {
        myProperties,
        managedProperties,
        allProperties: properties
    };
}

function buildPropertyStatusCounts(properties) {
    const counts = {
        total: properties.length,
        active: 0,
        sold: 0,
        rented: 0,
        draft: 0
    };

    for (const property of properties) {
        const status = String(property.status || '').trim().toLowerCase();
        if (status === 'sold') counts.sold += 1;
        else if (status === 'rented') counts.rented += 1;
        else if (status === 'draft') counts.draft += 1;
        else if (ACTIVE_PROPERTY_STATUSES.has(status)) counts.active += 1;
    }

    return counts;
}

function dashboardCacheKey(scope, userId, extras = {}) {
    const serialized = Object.keys(extras)
        .sort()
        .map((key) => `${key}:${Array.isArray(extras[key]) ? extras[key].join(',') : String(extras[key] ?? '')}`)
        .join('|');
    return `dashboard:${scope}:user:${userId}:${serialized}`;
}

async function cachedRows(scope, userId, ttlSeconds, query, params = [], extras = {}) {
    return fetchWithCache(
        dashboardCacheKey(scope, userId, extras),
        ttlSeconds,
        async () => (await pool.query(query, params)).rows
    );
}

module.exports = function(uploadVault, upload) {
    const router = express.Router();

    const getPhoneLookupValues = (phone) => {
        const rawPhone = typeof phone === 'string' ? phone.trim() : '';
        const phoneDigits = rawPhone.replace(/\D/g, '');
        return Array.from(new Set([rawPhone, phoneDigits.slice(-10)].filter(Boolean)));
    };

    const loadLinkedPhoneAccounts = async (user) => {
        if (!user.is_phone_verified) return [];

        const phoneLookupValues = getPhoneLookupValues(user.phone);
        if (phoneLookupValues.length === 0) return [];

        const accountsRes = await pool.query(
            `SELECT id, username, email, phone, role, account_number, created_at
             FROM users
             WHERE is_active IS DISTINCT FROM FALSE
               AND phone = ANY($1::text[])
             ORDER BY (id = $2) DESC, created_at DESC`,
            [phoneLookupValues, user.id]
        );

        return accountsRes.rows;
    };

    // --- Search Autocomplete API ---
    router.get('/api/search-suggestions', async (req, res) => {
        try {
            const query = req.query.q || '';
            const type = req.query.type || 'locality';
            if (query.length < 2) return res.json([]);
            
            let queryStr = "";
            let params = [`%${query}%`];
            
            if (type === 'locality') {
                queryStr = `
                    SELECT text FROM (
                        SELECT DISTINCT locality as text, 1 as priority FROM properties WHERE status IN ('listed', 'verified') AND locality ILIKE $1
                        UNION
                        SELECT DISTINCT title as text, 2 as priority FROM properties WHERE status IN ('listed', 'verified') AND title ILIKE $1
                        UNION
                        SELECT DISTINCT username as text, 3 as priority FROM users WHERE role IN ('builder', 'broker', 'external_sales', 'agent') AND username ILIKE $1
                        UNION
                        SELECT DISTINCT name as text, 4 as priority FROM projects WHERE name ILIKE $1
                    ) as combined ORDER BY priority ASC, text ASC LIMIT 10
                `;
            } else if (type === 'requirements') {
                queryStr = "SELECT text FROM (SELECT DISTINCT cities as text FROM corporate_requirements WHERE cities ILIKE $1 UNION SELECT DISTINCT locality as text FROM corporate_requirements WHERE locality ILIKE $1 UNION SELECT DISTINCT property_type as text FROM corporate_requirements WHERE property_type ILIKE $1) as combined LIMIT 10";
            } else if (type === 'users' && req.session && req.session.user && ['admin', 'support'].includes(req.session.user.role)) {
                queryStr = "SELECT text FROM (SELECT DISTINCT username as text FROM users WHERE username != 'Saksh' AND username ILIKE $1 UNION SELECT DISTINCT email as text FROM users WHERE username != 'Saksh' AND email ILIKE $1 UNION SELECT DISTINCT phone as text FROM users WHERE username != 'Saksh' AND phone ILIKE $1 UNION SELECT DISTINCT account_number as text FROM users WHERE username != 'Saksh' AND account_number ILIKE $1) as combined LIMIT 10";
            } else if (type === 'admin_properties' && req.session && req.session.user && ['admin', 'support'].includes(req.session.user.role)) {
                queryStr = "SELECT text FROM (SELECT DISTINCT title as text FROM properties WHERE title ILIKE $1 UNION SELECT DISTINCT locality as text FROM properties WHERE locality ILIKE $1) as combined LIMIT 10";
            } else if (type === 'bot_responses' && req.session && req.session.user && ['admin', 'support'].includes(req.session.user.role)) {
                queryStr = "SELECT text FROM (SELECT DISTINCT trigger_text as text FROM bot_responses WHERE trigger_text ILIKE $1) as combined LIMIT 10";
            } else {
                return res.json([]);
            }
            
            const searchRes = await pool.query(queryStr, params);
            let suggestions = searchRes.rows.map(r => r.text).filter(Boolean);
            
            // Add Photon place results for locality autocomplete without using public Nominatim autocomplete.
            if (type === 'locality' || type === 'requirements') {
                try {
                    const photonParams = new URLSearchParams({
                        q: query,
                        limit: '4',
                        lang: 'en',
                        lat: '28.6139',
                        lon: '77.2090'
                    });
                    const photonRes = await fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`, {
                        headers: { Accept: 'application/json' }
                    });
                    if (photonRes.ok) {
                        const photonData = await photonRes.json();
                        const photonNames = (photonData.features || [])
                            .filter(item => !item.properties?.countrycode || String(item.properties.countrycode).toUpperCase() === 'IN')
                            .map(item => {
                                const p = item.properties || {};
                                return [p.name, p.street, p.district, p.city, p.county, p.state, p.country]
                                    .filter(Boolean)
                                    .join(', ');
                            })
                            .filter(Boolean);
                        suggestions = [...new Set([...suggestions, ...photonNames])];
                    }
                } catch (placeErr) { console.error("Photon API fallback failed:", placeErr); }
            }
            
            return res.json(suggestions.slice(0, 10));
        } catch (err) {
            console.error("Autocomplete error:", err);
            return res.status(500).json([]);
        }
    });

    // --- User Dashboard & Interactions ---
    router.get('/recommended', async (req, res) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
        let recommendedProperties = [];
        try {
            const recentView = await pool.query('SELECT p.id, p.type, p.locality FROM recently_viewed rv JOIN properties p ON rv.property_id = p.id WHERE rv.user_id = $1 ORDER BY rv.viewed_at DESC LIMIT 1', [req.session.user.id]);
            if (recentView.rows.length > 0) {
                const { id, type, locality } = recentView.rows[0];
                const recRes = await pool.query("SELECT * FROM properties WHERE status = 'listed' AND id != $1 AND (type = $2 OR locality = $3) ORDER BY listed_at DESC LIMIT 50", [id, type, locality]);
                recommendedProperties = recRes.rows;
            } else if (req.session.user.saved_filters) {
                const filters = JSON.parse(req.session.user.saved_filters);
                if (filters.type || filters.locality) {
                    let recQuery = "SELECT * FROM properties WHERE status = 'listed'";
                    let params = [];
                    if (filters.type) { params.push(filters.type); recQuery += ` AND type = $${params.length}`; }
                    if (filters.locality) { params.push(`%${filters.locality}%`); recQuery += ` AND locality ILIKE $${params.length}`; }
                    recQuery += " ORDER BY listed_at DESC LIMIT 50";
                    const recRes2 = await pool.query(recQuery, params);
                    recommendedProperties = recRes2.rows;
                }
            }
        } catch (e) { console.error("Recommendation error:", e); }
        const favRes = await pool.query('SELECT property_id FROM favorites WHERE user_id = $1', [req.session.user.id]);
        if (wantsJson) return res.json({ properties: recommendedProperties, userFavorites: favRes.rows.map(r => r.property_id), query: req.query, pageTitle: "Recommended for You" });
        res.render('recommended', { properties: recommendedProperties, userFavorites: favRes.rows.map(r => r.property_id), query: req.query, pageTitle: "Recommended for You" });
    });

    router.post('/favorites/add', async (req, res) => {
        const isAjax = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return isAjax ? res.status(401).json({ error: 'Login required' }) : res.status(401).send('Login required');
        const { propertyId } = req.body;
        try {
            await pool.query('INSERT INTO favorites (user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.session.user.id, propertyId]);
            const propertyRes = await pool.query('SELECT title FROM properties WHERE id = $1', [propertyId]);
            const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [req.session.user.id]);
            if (propertyRes.rows.length > 0 && userRes.rows.length > 0) {
                await emailQueue.add('favoriteEmail', { email: userRes.rows[0].email, propertyTitle: propertyRes.rows[0].title });
            }
        } catch (err) { console.error("Error adding favorite or sending email:", err); }
        if (isAjax) return res.json({ success: true });
        res.redirect(req.get('Referer') || '/');
    });

    router.post('/favorites/remove', async (req, res) => {
        const isAjax = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return isAjax ? res.status(401).json({ error: 'Login required' }) : res.status(401).send('Login required');
        await pool.query('DELETE FROM favorites WHERE user_id = $1 AND property_id = $2', [req.session.user.id, req.body.propertyId]);
        if (isAjax) return res.json({ success: true });
        res.redirect(req.get('Referer') || '/favorites');
    });

    router.get('/favorites', async (req, res) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
        const result = await pool.query(`SELECT p.* FROM properties p JOIN favorites f ON p.id = f.property_id WHERE f.user_id = $1`, [req.session.user.id]);
        if (wantsJson) return res.json({ properties: result.rows });
        res.render('favorites', { properties: result.rows });
    });

    router.get('/recently-viewed', async (req, res) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
        const result = await pool.query(`SELECT p.* FROM properties p JOIN recently_viewed rv ON p.id = rv.property_id WHERE rv.user_id = $1 ORDER BY rv.viewed_at DESC LIMIT 20`, [req.session.user.id]);
        if (wantsJson) return res.json({ properties: result.rows });
        res.render('recently-viewed', { properties: result.rows });
    });

    router.get('/my-chats', (req, res) => {
        res.redirect('/messages');
    });

    // Get messages for a specific conversation securely
    router.get('/api/conversations/:id/messages', async (req, res) => {
        if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const convRes = await pool.query(`
                SELECT c.*, p.owner_id, p.assigned_broker_id 
                FROM property_conversations c 
                JOIN properties p ON c.property_id = p.id 
                WHERE c.id = $1
            `, [req.params.id]);
            if (convRes.rows.length === 0) return res.status(404).json({ error: 'Conversation not found' });
            
            const conv = convRes.rows[0];
            const isBuyer = conv.buyer_id === req.session.user.id;
            
            if (isBuyer && conv.unread_count_buyer > 0) {
                await pool.query('UPDATE property_conversations SET unread_count_buyer = 0 WHERE id = $1', [conv.id]);
            } else if (!isBuyer && conv.unread_count_owner > 0) {
                await pool.query('UPDATE property_conversations SET unread_count_owner = 0 WHERE id = $1', [conv.id]);
            }

            const msgsRes = await pool.query(`
                SELECT m.id, u.username as sender_username, m.content, m.created_at, m.is_read
                FROM chat_messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = $1 AND NOT ($2 = ANY(COALESCE(m.deleted_by, '{}'::int[])))
                ORDER BY created_at ASC
            `, [req.params.id, req.session.user.id]);

            res.json({ messages: msgsRes.rows, conversation: conv });
        } catch (e) { res.status(500).json({ error: 'Server error' }); }
    });

    // Handle Soft Deletion for Privacy
    router.delete('/api/conversations/:id', async (req, res) => {
        if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            await pool.query(`UPDATE property_conversations SET deleted_by = array_append(COALESCE(deleted_by, '{}'::int[]), $1) WHERE id = $2`, [req.session.user.id, req.params.id]);
            res.json({ success: true });
        } catch (e) { res.status(500).json({ error: 'Server error' }); }
    });

    router.get('/visits', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const result = await pool.query(`SELECT v.*, p.title, p.locality, p.final_price, p.photos FROM visits v JOIN properties p ON v.property_id = p.id WHERE v.user_id = $1 ORDER BY v.scheduled_at ASC`, [req.session.user.id]);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                visits: result.rows
            });
        }
        res.render('my-visits', { visits: result.rows });
    });

    router.post('/visits/update-status', validate(visitStatusSchema), async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        await pool.query('UPDATE visits SET status = $1 WHERE id = $2 AND user_id = $3', [req.body.status, req.body.visitId, req.session.user.id]);
        if (req.body.status === 'completed') {
            await pool.query("UPDATE referrals SET status = 'verified' WHERE referred_user_id = $1 AND status = 'pending'", [req.session.user.id]);
        }
        res.redirect('/visits');
    });

    router.post('/visits/schedule', validate(visitScheduleSchema), async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const { propertyId, preferredDate, preferredTime, contactNumber, message } = req.body;
        let createdVisitId = null;
        try {
            const insertRes = await pool.query('INSERT INTO visits (property_id, user_id, scheduled_at, status, preferred_date, preferred_time, contact_number, requester_message) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7) RETURNING id', [propertyId, req.session.user.id, 'requested', preferredDate || null, preferredTime || null, contactNumber || null, message || null]);
            const visitId = insertRes.rows[0].id;
            createdVisitId = visitId;
            
            await notificationService.sendNotification(req.session.user.id, `Visit requested. Waiting for owner to set a time.`, '/visits');
            
            const propRes = await pool.query(`
                SELECT p.title, p.locality, p.latitude, p.longitude, p.assigned_broker_id, p.owner_id,
                       u.email as owner_email, u.phone as owner_phone, u.username as owner_name,
                       b.email as broker_email, b.phone as broker_phone, b.username as broker_name
                FROM properties p 
                LEFT JOIN users u ON p.owner_id = u.id 
                LEFT JOIN users b ON p.assigned_broker_id = b.id
                WHERE p.id = $1`, [propertyId]);
            const renterRes = await pool.query('SELECT email, phone, name, username FROM users WHERE id = $1', [req.session.user.id]);
            if (propRes.rows.length > 0 && renterRes.rows.length > 0) {
                const prop = propRes.rows[0];
                const renter = renterRes.rows[0];
                
                const managerEmail = prop.broker_email || prop.owner_email;
                const managerPhone = prop.broker_phone || prop.owner_phone;
                const managerName = prop.broker_name || prop.owner_name || 'Manager';
                const renterName = renter.name || renter.username || 'A visitor';
                const preferredTime = 'To be decided by you'; // Fallback for WA template var
                
                const approveLink = `${req.protocol}://${req.headers.host}/visits/approve/${visitId}`;
                
                const { sendVisitRequestEmail } = require('./emailService');
                if (managerEmail) {
                    await sendVisitRequestEmail(managerEmail, managerName, renterName, prop.title, preferredTime, approveLink).catch(e => console.error('Email Error:', e));
                }

                if (managerPhone) {
                    waService.sendVisitRequestApproval(managerPhone, managerName, renterName, prop.title, preferredTime, visitId).catch(e => console.error('WA Error:', e));
                }
            }
        } catch (err) {
            console.error("Error scheduling visit:", err);
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(500).json({ success: false, error: 'Could not schedule visit right now.' });
            }
        }
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({ success: true, visitId: createdVisitId });
        }
        res.redirect(['admin', 'support'].includes(req.session.user.role) ? '/admin' : ['corporate', 'corporate_user'].includes(req.session.user.role) ? '/corporate' : (req.session.user.role === 'external_sales' ? '/external-sales' : '/visits'));
    });

    router.get('/visits/approve/:id', async (req, res) => {
        if (!req.session.user) return res.redirect(`/login?redirect=/visits/approve/${req.params.id}`);
        try {
            const visitRes = await pool.query(`
                SELECT v.*, p.title as property_title, u.username as renter_name, u.phone as renter_phone, u.email as renter_email 
                FROM visits v 
                JOIN properties p ON v.property_id = p.id 
                JOIN users u ON v.user_id = u.id 
                WHERE v.id = $1
            `, [req.params.id]);
            if (visitRes.rows.length === 0) return res.status(404).send('Visit not found');
            res.render('visit-approve', { user: req.session.user, visit: visitRes.rows[0] });
        } catch (err) { console.error(err); res.status(500).send('Server Error'); }
    });

    router.post('/visits/manage', validate(visitManageSchema), async (req, res) => {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        const { visit_id, action, finalDate, finalTime, managerNotes } = req.body;
        try {
            const visitRes = await pool.query(`
                SELECT v.user_id, v.agent_id, p.title, p.locality, p.latitude, p.longitude, p.owner_id, p.assigned_broker_id,
                       u.email as renter_email, u.phone as renter_phone, u.username as renter_name,
                       owner.name as owner_name, owner.username as owner_username, owner.phone as owner_phone
                FROM visits v 
                JOIN properties p ON v.property_id = p.id 
                JOIN users u ON v.user_id = u.id 
                LEFT JOIN users owner ON p.owner_id = owner.id
                WHERE v.id = $1
            `, [visit_id]);
            if (visitRes.rows.length > 0) {
                const visit = visitRes.rows[0];
                
                const isOwner = visit.owner_id === req.session.user.id;
                const isAssignedBroker = visit.assigned_broker_id === req.session.user.id;
                const isAssignedAgent = visit.agent_id === req.session.user.id;
                const isAdmin = ['admin', 'support'].includes(req.session.user.role);

                if (!isOwner && !isAssignedBroker && !isAssignedAgent && !isAdmin) {
                    return res.status(403).send('Unauthorized to manage this visit');
                }
                
                if (action === 'approve') {
                    const scheduledAt = finalDate && finalTime ? `${finalDate} ${finalTime}` : new Date().toISOString();
                    await pool.query('UPDATE visits SET status = $1, scheduled_at = $2, manager_notes = $3, approved_by = $4 WHERE id = $5', 
                        ['approved', scheduledAt, managerNotes || null, req.session.user.id, visit_id]);
                        
                    await notificationService.sendNotification(visit.user_id, `Your visit for ${visit.title} has been approved and scheduled for ${new Date(scheduledAt).toLocaleString()}`, '/visits');
                    
                    const visitDetails = { propertyTitle: visit.title, scheduledAt: scheduledAt, latitude: visit.latitude || null, longitude: visit.longitude || null };
                    const { sendVisitConfirmationEmail } = require('./emailService');
                    if (visit.renter_email) await sendVisitConfirmationEmail(visit.renter_email, 'renter', visitDetails).catch(console.error);
                    
                    if (visit.renter_phone) {
                        const contactName = visit.owner_name || visit.owner_username || 'Property Manager';
                        const shortName = visit.title.substring(0, 25);
                        
                        // Send New WA Template
                        waService.sendVisitApproval(
                            visit.renter_phone, visit.renter_name, visit.title, shortName, 
                            finalDate, finalTime, contactName, visit.owner_phone || 'N/A', visit.locality
                        ).catch(e => console.error('WA Approval Error:', e));
                    }
                    res.redirect(req.get('Referer') || '/visits');
                    
                } else if (action === 'reject') {
                    await pool.query('UPDATE visits SET status = $1, manager_notes = $2 WHERE id = $3', ['rejected', managerNotes || null, visit_id]);
                    await notificationService.sendNotification(visit.user_id, `Your visit request for ${visit.title} was rejected.`, '/visits');
                    
                    if (visit.renter_phone) {
                        waService.sendVisitRejection(visit.renter_phone, visit.renter_name, visit.title).catch(e => console.error('WA Rejection Error:', e));
                    }
                    if (visit.renter_email) {
                        // Send rejection email
                        await emailQueue.add('visitRejectionEmail', { email: visit.renter_email, renterName: visit.renter_name, propertyTitle: visit.title });
                    }
                    res.redirect(req.get('Referer') || '/visits');
                } else if (action === 'complete') {
                    await pool.query('UPDATE visits SET status = $1, manager_notes = $2 WHERE id = $3', ['completed', managerNotes || null, visit_id]);
                    await pool.query("UPDATE referrals SET status = 'verified' WHERE referred_user_id = $1 AND status = 'pending'", [visit.user_id]);
                    res.redirect(req.get('Referer') || '/visits');
                } else {
                    return res.status(400).send('Invalid action provided.');
                }
            } else {
                return res.status(404).send('Visit not found or you do not have permission.');
            }
        } catch (err) { console.error(err); res.status(500).send('Server Error'); }
    });
    router.get('/notifications', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const result = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.session.user.id]);
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                notifications: result.rows
            });
        }
        res.render('notifications', { notifications: result.rows });
    });

    const markNotificationsRead = async (req, res) => {
        const isAjax = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return isAjax ? res.status(401).send('Unauthorized') : res.redirect('/login');
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [req.session.user.id]);
        await notificationService.updateUnreadCount(req.session.user.id);
        if (isAjax) return res.sendStatus(200);
        return res.redirect('/notifications');
    };
    router.post('/notifications/mark-read', markNotificationsRead);
    router.get('/notifications/mark-read', markNotificationsRead);

    router.get(['/notifications/mark-all-read', '/my-chats/mark-read'], async (req, res) => {
        const isAjax = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return isAjax ? res.status(401).send('Unauthorized') : res.redirect('/login');
        try {
            let queryStr = req.path.includes('chats') ? "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND link LIKE '/property/%' AND (content LIKE 'New message%' OR content LIKE 'New reply%')" : 'UPDATE notifications SET is_read = TRUE WHERE user_id = $1';
            await pool.query(queryStr, [req.session.user.id]);
            await notificationService.updateUnreadCount(req.session.user.id);
            if (isAjax) return res.sendStatus(200);
        } catch (err) { console.error("Mark all read error:", err); if (isAjax) return res.status(500).send('Server Error'); }
        res.redirect(req.path.includes('chats') ? '/my-chats' : (req.get('Referer') || '/'));
    });
    
    router.post('/notifications/mark-chats-read', async (req, res) => {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        try {
            if (req.body.propertyId) {
                await pool.query("UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND link = $2", [req.session.user.id, `/property/${req.body.propertyId}`]);
            } else {
                await pool.query("UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND link LIKE '/property/%' AND (content LIKE 'New message%' OR content LIKE 'New reply%')", [req.session.user.id]);
            }
            await notificationService.updateUnreadCount(req.session.user.id);
            res.sendStatus(200);
        } catch (err) { res.status(500).send("Server Error"); }
    });

    router.post('/notifications/clear-all', async (req, res) => {
        const isAjax = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return isAjax ? res.status(401).send('Unauthorized') : res.redirect('/login');
        try {
            await pool.query('DELETE FROM notifications WHERE user_id = $1', [req.session.user.id]);
            if (isAjax) return res.sendStatus(200);
        } catch (err) { if (isAjax) return res.status(500).send('Server Error'); }
        res.redirect(req.get('Referer') || '/');
    });

    router.post('/user/save-search', async (req, res) => {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        const filters = JSON.stringify(req.body);
        await pool.query('UPDATE users SET saved_filters = $1 WHERE id = $2', [filters, req.session.user.id]);
        req.session.user.saved_filters = filters;
        res.sendStatus(200);
    });

    router.post('/user/change-password', async (req, res) => {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        const passwordError = validatePassword(req.body.newPassword);
        if (passwordError) return res.status(400).send(passwordError);
        if (await isPasswordReused(req.session.user.id, req.body.newPassword)) return res.status(400).send("You cannot reuse your last 3 passwords.");
        try {
            const userRes = await pool.query('SELECT password_hash, has_random_password FROM users WHERE id = $1', [req.session.user.id]);
            if (userRes.rows.length === 0) return res.status(404).send('User not found');
            
            const isRandom = userRes.rows[0].has_random_password;
            
            if (isRandom || await bcrypt.compare(req.body.currentPassword || '', userRes.rows[0].password_hash)) {
                const hash = await bcrypt.hash(req.body.newPassword, 10);
                await pool.query('UPDATE users SET password_hash = $1, has_random_password = FALSE WHERE id = $2', [hash, req.session.user.id]);
                await addToPasswordHistory(req.session.user.id, hash);
                req.session.user.has_random_password = false;
                res.sendStatus(200);
            } else { res.status(400).send('Incorrect current password'); }
        } catch (err) { res.status(500).send('Server error'); }
    });

    router.get('/user/2fa/setup', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const secret = speakeasy.generateSecret({ length: 20, name: `MatrixSpaces (${req.session.user.email})` });
        const recoveryCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex'));
        QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
            res.render('setup-2fa', { qr_code: data_url, secret: secret.base32, recoveryCodes, user: req.session.user, enforced: false });
        });
    });

    router.post('/user/2fa/verify', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const { token, secret, recoveryCodes } = req.body;
        if (speakeasy.totp.verify({ secret: secret, encoding: 'base32', token: token })) {
            const hashedCodes = await Promise.all((JSON.parse(recoveryCodes || '[]')).map(code => bcrypt.hash(code, 10)));
            await pool.query('UPDATE users SET two_factor_secret = $1, is_two_factor_enabled = TRUE, recovery_codes = $2 WHERE id = $3', [secret, JSON.stringify(hashedCodes), req.session.user.id]);
            req.session.user.is_two_factor_enabled = true;
            req.session.user.two_factor_secret = secret;
            res.redirect('/profile');
        } else {
            QRCode.toDataURL(`speakeasy`.otpauthURL({ secret: secret, label: `MatrixSpaces (${req.session.user.email})`, encoding: 'base32' }), (err, data_url) => {
                res.render('setup-2fa', { qr_code: data_url, secret, recoveryCodes: JSON.parse(recoveryCodes || '[]'), user: req.session.user, error: 'Invalid token. Please try again.', enforced: false });
            });
        }
    });

    router.post('/user/2fa/disable', async (req, res) => {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        try {
            const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.user.id]);
            if (await bcrypt.compare(req.body.password, userRes.rows[0].password_hash)) {
                await pool.query('UPDATE users SET two_factor_secret = NULL, is_two_factor_enabled = FALSE, recovery_codes = $1 WHERE id = $2', ['[]', req.session.user.id]);
                req.session.user.is_two_factor_enabled = false;
                req.session.user.two_factor_secret = null;
                res.sendStatus(200);
            } else { res.status(400).send('Incorrect password'); }
        } catch (err) { res.status(500).send('Server error'); }
    });

    // --- Profile & Vault ---
    router.get(['/profile', '/edit-profile', '/avatar-studio'], async (req, res) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
        
        // Auto-generate referral code for legacy accounts so the button is always visible
        if (!req.session.user.referral_code) {
            const newCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [newCode, req.session.user.id]);
            req.session.user.referral_code = newCode;
        }
        
        // Always ensure the user's wallet_balance is fresh!
        const userFresh = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [req.session.user.id]);
        if (userFresh.rows.length > 0) req.session.user.wallet_balance = userFresh.rows[0].wallet_balance;

        let referredUsers = [];
        let withdrawals = [];
        if (req.path === '/profile') {
            const refRes = await pool.query(`
                SELECT u.username, u.role, u.created_at, r.status, r.amount 
                FROM users u LEFT JOIN referrals r ON u.id = r.referred_user_id AND r.referrer_id = $1 
                WHERE u.referred_by = $2 ORDER BY u.created_at DESC
            `, [req.session.user.id, req.session.user.referral_code]);
            referredUsers = refRes.rows;
            
            const withdrawalRes = await pool.query('SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC', [req.session.user.id]);
            withdrawals = withdrawalRes.rows;
        }

        let duplicateAccounts = [];
        if (req.path === '/edit-profile') {
            duplicateAccounts = await loadLinkedPhoneAccounts(req.session.user);
        }

        const payload = {
            user: req.session.user,
            referredUsers,
            withdrawals,
            duplicateAccounts,
            error: req.query.error || null,
            message: req.query.message || null
        };

        if (wantsJson) return res.json(payload);

        res.render(req.path.slice(1), payload);
    });

    router.post('/edit-profile', upload.fields([{ name: 'profile_photo', maxCount: 1 }, { name: 'cover_photo', maxCount: 1 }]), async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const redirectWithFieldError = (field, message) => res.redirect(`/profile?${field}=${encodeURIComponent(message)}`);
        try {
            const { name, username, email, phone, about, facebook, linkedin, instagram, city, locality, agency_name, google_business_link, gst_number, rera_number, company_website } = req.body;
            const normalizedUsername = typeof username === 'string' ? username.trim() : username;
            const normalizedEmail = typeof email === 'string' ? email.trim() : email;
            const normalizedPhone = typeof phone === 'string' ? phone.trim() : phone;
            const finalPhone = normalizedPhone === '' ? null : normalizedPhone;

            if (RESERVED_USERNAMES.has(normalizedUsername.toLowerCase())) {
                return redirectWithFieldError('usernameError', 'This username is reserved and cannot be used.');
            }

            let avatarUrl = req.session.user.avatar_url;
            let coverUrl = req.session.user.cover_url;
            
            if (req.files && Object.keys(req.files).length > 0) {
                const profilePhoto = req.files['profile_photo'] ? req.files['profile_photo'][0] : null;
                const coverPhoto = req.files['cover_photo'] ? req.files['cover_photo'][0] : null;
                if (profilePhoto) avatarUrl = profilePhoto.location || (profilePhoto.key ? getS3BaseUrl() + profilePhoto.key : '/uploads/' + profilePhoto.filename);
                if (coverPhoto) coverUrl = coverPhoto.location || (coverPhoto.key ? getS3BaseUrl() + coverPhoto.key : '/uploads/' + coverPhoto.filename);
            }
            
            let finalCity = req.session.user.city;
            let finalLocality = req.session.user.locality;
            
            // Only validate location constraints if new location data was passed in the request
            if (city !== undefined || locality !== undefined) {
                const newCity = city !== undefined ? city : req.session.user.city;
                const newLocality = locality !== undefined ? locality : req.session.user.locality;

                // Brokers, dealers, and agents are now allowed to change their localities freely
                finalCity = newCity;
                finalLocality = newLocality;
            }
            
            let finalName = req.session.user.name;
            if (name && name.trim() !== (req.session.user.name || '')) {
                try {
                    const timeRes = await pool.query('SELECT name_last_changed FROM users WHERE id = $1', [req.session.user.id]);
                    const lastChanged = timeRes.rows[0]?.name_last_changed;
                    
                    if (lastChanged) {
                        const daysSinceChange = (new Date() - new Date(lastChanged)) / (1000 * 60 * 60 * 24);
                        if (daysSinceChange < 90) {
                            return res.render('edit-profile', { 
                                user: req.session.user, 
                                error: `You can only change your name once every 3 months. Last changed ${Math.floor(daysSinceChange)} days ago.`,
                                referredUsers: [], 
                                withdrawals: []
                            });
                        }
                    }
                    
                    await pool.query('UPDATE users SET name_last_changed = NOW() WHERE id = $1', [req.session.user.id]);
                    finalName = name.trim();
                } catch (e) {
                    console.error("Error updating name:", e);
                }
            }

            // Check for duplicate username, email, or phone before updating.
            // Phone may not be unique at the database level, so it is checked explicitly.
            const duplicateChecks = [
                { column: 'email', value: normalizedEmail, message: 'This email address is already in use by another account.' },
                { column: 'username', value: normalizedUsername, message: 'This username is already taken. Please choose another.' },
                { column: 'phone', value: finalPhone, message: 'This phone number is already linked to another account.' }
            ];

            for (const check of duplicateChecks) {
                if (check.value === null || check.value === undefined || check.value === '') continue;
                const duplicateCheck = await pool.query(
                    `SELECT id FROM users WHERE id != $1 AND ${check.column} = $2 LIMIT 1`,
                    [req.session.user.id, check.value]
                );

                if (duplicateCheck.rows.length > 0) {
                    if (check.column === 'username') return redirectWithFieldError('usernameError', check.message);
                    if (check.column === 'phone') return redirectWithFieldError('phoneError', check.message);
                    return res.redirect(`/profile?error=${encodeURIComponent(check.message)}`);
                }
            }

            await pool.query('UPDATE users SET name = $1, username = $2, email = $3, phone = $4, about = $5, facebook = $6, linkedin = $7, instagram = $8, avatar_url = $9, cover_url = $10, city = $11, locality = $12, agency_name = $13, google_business_link = $14, gst_number = $15, rera_number = $16, company_website = $17, name_last_changed = NOW() WHERE id = $18', 
                [finalName, normalizedUsername, normalizedEmail, finalPhone, about || '', facebook || '', linkedin || '', instagram || '', avatarUrl, coverUrl, finalCity, finalLocality, agency_name || req.session.user.agency_name, google_business_link || req.session.user.google_business_link, gst_number || req.session.user.gst_number, rera_number || req.session.user.rera_number, company_website || req.session.user.company_website, req.session.user.id]);
            Object.assign(req.session.user, { name: finalName, username: normalizedUsername, email: normalizedEmail, phone: finalPhone, about, facebook, linkedin, instagram, avatar_url: avatarUrl, cover_url: coverUrl, city: finalCity, locality: finalLocality, agency_name: agency_name || req.session.user.agency_name, google_business_link: google_business_link || req.session.user.google_business_link, gst_number: gst_number || req.session.user.gst_number, rera_number: rera_number || req.session.user.rera_number, company_website: company_website || req.session.user.company_website });
            res.redirect('/profile');
        } catch (err) { 
            console.error("Profile update error:", err);
            let errorMessage = 'Error updating profile.';
            if (err.code === '23505') {
                if (err.constraint && err.constraint.includes('email')) {
                    errorMessage = 'This email address is already in use by another account.';
                } else if (err.constraint && err.constraint.includes('username')) {
                    return redirectWithFieldError('usernameError', 'This username is already taken. Please choose another.');
                } else {
                    errorMessage = 'Username or Email is already in use.';
                }
            }
            res.redirect(`/profile?error=${encodeURIComponent(errorMessage)}`);
        }
    });

    router.post('/user/withdraw', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const { amount, payment_details } = req.body;
        try {
            await pool.query('BEGIN');
            const userRes = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [req.session.user.id]);
            const balance = parseFloat(userRes.rows[0].wallet_balance || 0);
            const withdrawAmount = parseFloat(amount);
            
            // Secure check to ensure they have enough funds
            if (withdrawAmount > 0 && balance >= withdrawAmount) {
                await pool.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [withdrawAmount, req.session.user.id]);
                await pool.query('INSERT INTO withdrawals (user_id, amount, payment_details, status) VALUES ($1, $2, $3, $4)', [req.session.user.id, withdrawAmount, payment_details, 'pending']);
                await notificationService.sendNotification(
                    req.session.user.id,
                    `Your withdrawal request of ₹${withdrawAmount} is under process. It will be credited in 2-3 working days.`,
                    '/wallet'
                );
            }
            await pool.query('COMMIT');
        } catch (err) { 
            await pool.query('ROLLBACK');
            console.error("Withdrawal request error:", err); 
        }
        res.redirect('/wallet');
    });

    router.get('/wallet', async (req, res) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
        
        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Withdrawals per page
        const offset = (page - 1) * limit;

        // Always ensure the user's wallet_balance is fresh!
        const userFresh = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [req.session.user.id]);
        if (userFresh.rows.length > 0) req.session.user.wallet_balance = userFresh.rows[0].wallet_balance;

        const withdrawalRes = await pool.query('SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [req.session.user.id, limit, offset]);
        const withdrawals = withdrawalRes.rows;

        if (wantsJson) return res.json({
            user: req.session.user,
            withdrawals,
            pageTitle: "My Wallet",
            currentPage: page,
            hasMore: withdrawals.length === limit
        });

        res.render('wallet', { 
            user: req.session.user, 
            withdrawals, 
            pageTitle: "My Wallet",
            currentPage: page,
            hasMore: withdrawals.length === limit
        });
    });

    router.get('/vault', async (req, res) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
        
        const folderId = req.query.folderId;
        let documents = [];
        let currentFolder = null;
        
        const foldersRes = await pool.query('SELECT * FROM vault_folders WHERE user_id = $1 ORDER BY created_at DESC', [req.session.user.id]);
        const folders = foldersRes.rows;

        if (folderId) {
            const folderRes = await pool.query('SELECT * FROM vault_folders WHERE id = $1 AND user_id = $2', [folderId, req.session.user.id]);
            if (folderRes.rows.length > 0) {
                currentFolder = folderRes.rows[0];
            }
            const docsRes = await pool.query('SELECT * FROM vault_documents WHERE user_id = $1 AND folder_id = $2 ORDER BY created_at DESC', [req.session.user.id, folderId]);
            documents = docsRes.rows;
        } else {
            const docsRes = await pool.query('SELECT * FROM vault_documents WHERE user_id = $1 AND folder_id IS NULL ORDER BY created_at DESC', [req.session.user.id]);
            documents = docsRes.rows;
        }

        if (wantsJson) {
            return res.json({
                user: req.session.user,
                documents,
                folders,
                currentFolder
            });
        }
        res.render('vault', { user: req.session.user, documents, folders, currentFolder });
    });

    router.post('/vault/folder/create', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const { folderName } = req.body;
        if (folderName) {
            await pool.query('INSERT INTO vault_folders (user_id, name) VALUES ($1, $2)', [req.session.user.id, folderName]);
            
            // Explicitly create this folder in the AWS S3 Bucket
            try {
                const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
                const s3 = new S3Client({ region: process.env.AWS_REGION });
                await s3.send(new PutObjectCommand({
                    Bucket: process.env.AWS_S3_BUCKET_NAME,
                    Key: `vault/${req.session.user.id}/${folderName}/`,
                    Body: Buffer.from('')
                }));
            } catch (err) { console.error("S3 Folder creation error:", err); }
        }
        res.redirect('/vault');
    });

    // Activate Vault (Explicitly create user root folder in S3)
    router.post('/vault/activate', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        try {
            const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
            const s3 = new S3Client({ region: process.env.AWS_REGION });
            
            // Creates an empty folder in S3 with the user's ID
            await s3.send(new PutObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: `vault/${req.session.user.id}/`,
                Body: Buffer.from('')
            }));
            res.redirect('/vault?message=Vault+Activated+Successfully');
        } catch (err) {
            console.error("Vault activation error:", err);
            res.redirect('/vault?error=Activation+Failed');
        }
    });

    router.post('/vault/upload', uploadVault.single('document'), async (req, res) => {
        if (!req.session.user || !req.file) return res.redirect('/login');
        let finalName = req.body.documentName === 'Other' ? req.body.customDocumentName : req.body.documentName;
        if (!finalName) finalName = req.file.originalname;
        if (req.body.documentNumber) finalName = `${finalName} - ${req.body.documentNumber}`;
        let savedFilename = req.file.key || req.file.filename;
        
        const folderId = req.body.folderId || null;
        await pool.query('INSERT INTO vault_documents (user_id, filename, file_path, folder_id) VALUES ($1, $2, $3, $4)', [req.session.user.id, finalName, savedFilename, folderId]);
        res.redirect(folderId ? `/vault?folderId=${folderId}` : '/vault');
    });

    router.post('/vault/delete/:id', async (req, res) => {
        if (!req.session.user) return res.redirect('/login');
        const docRes = await pool.query('SELECT file_path FROM vault_documents WHERE id = $1 AND user_id = $2', [req.params.id, req.session.user.id]);
        if (docRes.rows.length > 0) {
            const filePath = docRes.rows[0].file_path;
            await pool.query('DELETE FROM vault_documents WHERE id = $1', [req.params.id]);
            
            if (filePath && filePath.startsWith('vault/')) {
                try {
                    const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
                    const s3 = new S3Client({ region: process.env.AWS_REGION });
                    await s3.send(new DeleteObjectCommand({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: filePath
                    }));
                } catch (err) { console.error('S3 Delete Error:', err); }
            } else {
                const vaultDir = path.join(__dirname, './vault_uploads/');
                if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
                fs.unlink(path.join(vaultDir, filePath), () => {});
            }
        }
        res.redirect('/vault');
    });

    // Route to render the profile completion form
    router.get('/complete-profile', (req, res) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) return wantsJson ? res.status(401).json({ error: 'Unauthorized' }) : res.redirect('/login');
        const isDemo = (req.session.user.name || '').toLowerCase().includes('demo') || (req.session.user.username || '').toLowerCase().includes('demo');
        if (isDemo || (req.session.user.profile_completed && !req.session.user.isRandomName)) {
            return wantsJson ? res.json({ user: req.session.user, completed: true }) : res.redirect('/');
        }
        const payload = { user: req.session.user, error: req.query.error || null, message: null, completed: false };
        if (wantsJson) return res.json(payload);
        res.render('complete-profile', payload);
    });

    // New route for post-signup profile completion
    router.post('/complete-profile', validate(require('./auth.schema').profileCompletionSchema, 'complete-profile', 'complete-profile'), async (req, res) => {
        const isAjax = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user) {
            return isAjax ? res.status(401).json({ error: 'You must be logged in to complete your profile.' }) : res.redirect('/login');
        }
        const { name, email, agency_name, gst_number, rera_number } = req.body;
        const userId = req.session.user.id;
        const userRole = req.session.user.role;

        // Basic validation
        if (!name || name.trim().length < 1) {
            return isAjax ? res.status(400).json({ error: 'Full Name is required.' }) : res.render('complete-profile', { user: req.session.user, error: 'Full Name is required.', message: null });
        }
        if (!email || !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
            return isAjax ? res.status(400).json({ error: 'A valid email address is required.' }) : res.render('complete-profile', { user: req.session.user, error: 'A valid email address is required.', message: null });
        }
        if (['broker', 'builder', 'corporate'].includes(userRole) && (!agency_name || agency_name.trim().length < 1)) { // Changed to 1 for minimal name
            return isAjax ? res.status(400).json({ error: 'Company Name is required for your role.' }) : res.render('complete-profile', { user: req.session.user, error: 'Company Name is required for your role.', message: null });
        }

        try {
            // Check for duplicate email if changed
            if (email !== req.session.user.email) {
                const existingEmail = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
                if (existingEmail.rows.length > 0) {
                    return isAjax ? res.status(400).json({ error: 'This email is already in use by another account.' }) : res.render('complete-profile', { user: req.session.user, error: 'This email is already in use by another account.', message: null });
                }
            }

            const cleanName = name.trim();
            const baseUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (RESERVED_USERNAMES.has(baseUsername)) {
                return isAjax ? res.status(400).json({ error: 'This name is too common and cannot be used as a username.' }) : res.render('complete-profile', { user: req.session.user, error: 'This name is too common and cannot be used as a username.', message: null });
            }

            let uniqueUsername = baseUsername || 'user';
            let counter = 1;
            
            // Ensure username is unique
            while (true) {
                const checkRes = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [uniqueUsername, userId]);
                if (checkRes.rows.length === 0) break;
                uniqueUsername = `${baseUsername}${counter}`;
                counter++;
            }

            await pool.query(
                'UPDATE users SET name = $1, username = $2, email = $3, agency_name = $4, gst_number = $5, rera_number = $6, profile_completed = TRUE, name_last_changed = NOW() WHERE id = $7',
                [cleanName, uniqueUsername, email, agency_name || null, gst_number || null, rera_number || null, userId]
            );
            
            // Update session
            Object.assign(req.session.user, { name: cleanName, username: uniqueUsername, email, agency_name, gst_number, rera_number, profile_completed: true, name_last_changed: new Date() });

            // Check if this action completes a pending referral
            try {
                const refRes = await pool.query("SELECT id, referrer_id, amount FROM referrals WHERE referred_user_id = $1 AND status = 'pending'", [userId]);
                if (refRes.rows.length > 0) {
                    const ref = refRes.rows[0];
                    const uRes = await pool.query("SELECT is_phone_verified FROM users WHERE id = $1", [userId]);
                    if (uRes.rows.length > 0 && uRes.rows[0].is_phone_verified) {
                        await pool.query("UPDATE referrals SET status = 'completed' WHERE id = $1", [ref.id]);
                        await pool.query("UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2", [ref.amount || 50, ref.referrer_id]);
                    }
                }
            } catch (e) { console.error("Referral completion error:", e); }

            if (isAjax) return res.json({ success: true, message: "Profile completed successfully." });
            return res.redirect('/');
        } catch (err) {
            console.error("Complete Profile Error:", err);
            return isAjax ? res.status(500).json({ error: 'Server error during profile completion.' }) : res.render('complete-profile', { user: req.session.user, error: 'Server error during profile completion.', message: null });
        }
    });

    router.post('/user/delete-account', async (req, res) => {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        try {
            const userId = req.session.user.id;
            const targetUserId = parseInt(req.body.account_id || userId, 10);
            if (!Number.isInteger(targetUserId)) {
                return res.redirect('/edit-profile?error=Invalid+account+selected.');
            }

            if (targetUserId !== userId) {
                const currentUserRes = await pool.query('SELECT id, phone, is_phone_verified FROM users WHERE id = $1', [userId]);
                const currentUser = currentUserRes.rows[0];

                if (!currentUser || !currentUser.is_phone_verified) {
                    return res.redirect('/edit-profile?error=Verify+your+phone+number+before+deleting+linked+accounts.');
                }

                const phoneLookupValues = getPhoneLookupValues(currentUser.phone);
                if (phoneLookupValues.length === 0) {
                    return res.redirect('/edit-profile?error=No+verified+phone+number+found+for+this+account.');
                }

                const linkedAccountRes = await pool.query(
                    `SELECT id FROM users
                     WHERE id = $1
                       AND is_active IS DISTINCT FROM FALSE
                       AND phone = ANY($2::text[])`,
                    [targetUserId, phoneLookupValues]
                );

                if (linkedAccountRes.rows.length === 0) {
                    return res.redirect('/edit-profile?error=You+can+only+delete+accounts+linked+to+your+verified+phone+number.');
                }
            }

            const scrambleStr = `_deleted_${Date.now()}`;
            await pool.query(
                `UPDATE users SET 
                    is_active = FALSE, 
                    email = CONCAT(email, $1::text), 
                    phone = CONCAT(phone, $1::text)
                WHERE id = $2`, 
                [scrambleStr, targetUserId]
            );

            if (targetUserId !== userId) {
                return res.redirect('/edit-profile?message=Linked+account+deleted+successfully.');
            }

            req.session.destroy(() => {
                res.clearCookie('connect.sid', { path: '/' });
                res.redirect('/login?message=Your+account+has+been+successfully+deleted.');
            });
        } catch (err) { res.redirect('/edit-profile?error=Failed+to+delete+account.'); }
    });

    // Secure route to serve Vault documents
    router.get('/vault/file/*filename', async (req, res) => {
        if (!req.session.user) return res.status(401).send('Unauthorized');
        
        let filename = req.params.filename || req.params[0] || ''; 
        if (Array.isArray(filename)) filename = filename.join('/');
        // Verify the user actually owns this document
        const docRes = await pool.query('SELECT * FROM vault_documents WHERE file_path = $1 AND user_id = $2', [filename, req.session.user.id]);
        if (docRes.rows.length === 0) return res.status(403).send('Forbidden or File Not Found');
        
        if (filename.startsWith('vault/')) {
            return res.redirect(getS3BaseUrl() + filename);
        }
        
        const vaultDir = path.join(__dirname, './vault_uploads/');
        if (!fs.existsSync(vaultDir)) fs.mkdirSync(vaultDir, { recursive: true });
        
        const filePath = path.join(vaultDir, filename);
        if (!fs.existsSync(filePath)) return res.status(404).send('File missing from server');
        res.sendFile(filePath);
    });

    router.get('/list-property', (req, res) => {
        if (!req.session.user) {
            return res.redirect('/login');
        }
        if (['corporate', 'corporate_user'].includes(req.session.user.role)) {
            return res.redirect('/corporate?tab=requirements');
        }
        res.render('list-property', { user: req.session.user, pageTitle: "List a New Property" });
    });

    // --- Business to Business (B2B) Dashboards ---
    router.get('/dealer', (req, res) => {
        res.redirect('/builder');
    });

    router.get('/agent', (req, res) => {
        res.redirect('/broker');
    });

    router.get('/broker', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'broker') return res.redirect('/login');
        const permissions = await getUserPermissions(req.session.user.id);
        const userId = req.session.user.id;
        const [
            myVisitsRows,
            assignedPropsRows,
            allPropertiesRows,
            allTenantsRows,
            activePropertiesRows,
            visitRequestRows,
            assignedProjectRows,
            myLeadRows,
            scheduleRows,
            taskRows,
            transactionRows,
            agentRows,
            myRequirementRows,
            requirementSuggestionRows
        ] = await Promise.all([
            cachedRows('broker-visits', userId, 20, `SELECT v.*, p.title as property_title, p.locality, p.photos, u.username as renter_name, u.phone as renter_phone, a.username as agent_name, parent.username as parent_name FROM visits v JOIN properties p ON v.property_id = p.id JOIN users u ON v.user_id = u.id LEFT JOIN users a ON v.agent_id = a.id LEFT JOIN users parent ON a.parent_id = parent.id WHERE v.agent_id = $1 OR v.agent_id IN (SELECT id FROM users WHERE parent_id = $1) ORDER BY v.scheduled_at ASC`, [userId]),
            cachedRows('broker-assigned-properties', userId, 20, `SELECT p.*, u.username as owner_name, u.phone as owner_phone, u.email as owner_email FROM properties p LEFT JOIN users u ON p.owner_id = u.id WHERE p.assigned_broker_id = $1 OR $1 = ANY(COALESCE(p.assigned_brokers, '{}'::int[])) ORDER BY p.created_at DESC`, [userId]),
            cachedRows('broker-property-options', userId, 20, `SELECT DISTINCT p.id, p.title, p.locality FROM properties p WHERE p.assigned_broker_id = $1 OR $1 = ANY(COALESCE(p.assigned_brokers, '{}'::int[])) ORDER BY p.title ASC`, [userId]),
            cachedRows('broker-tenant-options', userId, 20, `SELECT DISTINCT u.id, u.username, u.email, u.phone FROM users u WHERE u.id IN ( SELECT v.user_id FROM visits v WHERE v.agent_id = $1 OR v.agent_id IN (SELECT id FROM users WHERE parent_id = $1) UNION SELECT pc.buyer_id FROM property_conversations pc JOIN properties p ON p.id = pc.property_id WHERE p.assigned_broker_id = $1 OR $1 = ANY(COALESCE(p.assigned_brokers, '{}'::int[])) ) ORDER BY u.username ASC`, [userId]),
            cachedRows('broker-active-properties', userId, 20, `SELECT p.*, u.username as owner_name, u.phone as owner_phone, u.email as owner_email FROM properties p LEFT JOIN users u ON p.owner_id = u.id WHERE p.status IN ('listed', 'reviewing', 'negotiating', 'unlisted') AND ( p.assigned_broker_id = $1 OR $1 = ANY(COALESCE(p.assigned_brokers, '{}'::int[])) ) ORDER BY p.created_at DESC`, [userId]),
            cachedRows('broker-visit-requests', userId, 20, `SELECT v.*, p.title as property_title, p.locality, p.photos, u.username as renter_name, u.phone as renter_phone, a.username as agent_name, parent.username as parent_name FROM visits v JOIN properties p ON v.property_id = p.id JOIN users u ON v.user_id = u.id LEFT JOIN users a ON v.agent_id = a.id LEFT JOIN users parent ON a.parent_id = parent.id WHERE (p.owner_id = $1 OR p.assigned_broker_id = $1 OR $1 = ANY(COALESCE(p.assigned_brokers, '{}'::int[]))) ORDER BY v.created_at DESC`, [userId]),
            cachedRows('broker-projects', userId, 30, `SELECT p.*, u.agency_name as builder_name FROM projects p JOIN project_brokers pb ON p.id = pb.project_id JOIN users u ON p.builder_id = u.id WHERE pb.broker_id = $1 ORDER BY p.created_at DESC`, [userId]),
            cachedRows('broker-leads', userId, 20, `SELECT l.*, u.username as assigned_agent_name FROM leads l LEFT JOIN users u ON l.agent_id = u.id WHERE l.agent_id = $1 OR l.agent_id IN (SELECT id FROM users WHERE parent_id = $1) ORDER BY l.created_at DESC`, [userId]),
            cachedRows('broker-schedules', userId, 20, `SELECT s.*, l.name as lead_name, l.email as lead_email FROM agent_schedules s LEFT JOIN leads l ON s.reference_id = l.id WHERE s.agent_id = $1 ORDER BY s.scheduled_at ASC`, [userId]),
            cachedRows('broker-tasks', userId, 20, `SELECT t.*, assignee.username as assignee_name, creator.username as creator_name, p.title as property_title, l.name as lead_name FROM agent_tasks t LEFT JOIN users assignee ON t.assigned_to = assignee.id LEFT JOIN users creator ON t.created_by = creator.id LEFT JOIN properties p ON t.related_property_id = p.id LEFT JOIN leads l ON t.related_lead_id = l.id WHERE t.created_by = $1 OR t.assigned_to = $1 OR t.assigned_to IN (SELECT id FROM users WHERE parent_id = $1 AND role = 'external_sales') ORDER BY t.created_at DESC`, [userId]),
            cachedRows('broker-transactions', userId, 20, `SELECT st.*, p.title as property_title FROM sales_transactions st LEFT JOIN properties p ON st.property_id = p.id WHERE st.agent_id = $1 OR st.agent_id IN (SELECT id FROM users WHERE parent_id = $1) ORDER BY st.created_at DESC`, [userId]),
            cachedRows('broker-agents', userId, 30, `SELECT id, username, email, role, phone, avatar_url, COALESCE(permissions, '{}'::jsonb) as permissions FROM users WHERE parent_id = $1 AND role = 'external_sales' AND COALESCE(sales_agent_type, 'associated') = 'associated' ORDER BY username ASC`, [userId]),
            cachedRows('broker-requirements', userId, 20, `SELECT * FROM corporate_requirements WHERE corporate_id = $1 ORDER BY created_at DESC`, [userId]),
            cachedRows('broker-requirement-suggestions', userId, 20, `SELECT rs.*, p.title as property_title, p.locality, p.final_price, p.type, p.photos, cr.cities as req_cities, cr.property_type as req_type FROM requirement_suggestions rs JOIN properties p ON rs.property_id = p.id JOIN corporate_requirements cr ON rs.requirement_id = cr.id WHERE cr.corporate_id = $1 AND rs.status = 'approved' ORDER BY rs.created_at DESC`, [userId]).catch(() => [])
        ]);
        const myVisits = { rows: myVisitsRows };
        const assignedProps = { rows: assignedPropsRows };
        const brokerPropertyGroups = classifyDashboardProperties(assignedProps.rows, req.session.user.id);
        const brokerMyPropertyCounts = buildPropertyStatusCounts(brokerPropertyGroups.myProperties);
        const brokerManagedPropertyCounts = buildPropertyStatusCounts(brokerPropertyGroups.managedProperties);
        const allProperties = { rows: allPropertiesRows };
        const allTenants = { rows: allTenantsRows };
        const activeProperties = { rows: activePropertiesRows };
        const visitRequestsRes = { rows: visitRequestRows };
        const assignedProjects = { rows: assignedProjectRows };
        const myLeads = { rows: myLeadRows };
        const schedulesRes = { rows: scheduleRows };
        const tasksRes = { rows: taskRows };
        const transactionsRes = { rows: transactionRows };
        const agentsUnderBuilder = [{ id: req.session.user.id, username: 'Myself', email: req.session.user.email, role: req.session.user.role, phone: req.session.user.phone, avatar_url: req.session.user.avatar_url }, ...agentRows];
        const myReqsRes = { rows: myRequirementRows };
        const mySuggRes = { rows: requirementSuggestionRows };

        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                user: req.session.user,
                permissions,
                visits: myVisits.rows,
                    visitRequests: visitRequestsRes.rows,
                myProperties: brokerPropertyGroups.myProperties,
                managedProperties: brokerPropertyGroups.managedProperties,
                allPropertiesList: brokerPropertyGroups.allProperties,
                myPropertiesTotal: brokerMyPropertyCounts.total,
                myPropertiesActive: brokerMyPropertyCounts.active,
                myPropertiesSold: brokerMyPropertyCounts.sold,
                myPropertiesRented: brokerMyPropertyCounts.rented,
                myPropertiesDraft: brokerMyPropertyCounts.draft,
                managedPropertiesCount: brokerManagedPropertyCounts.total,
                assignedPropertiesCount: assignedProps.rows.length,
                assignedProperties: assignedProps.rows,
                allProperties: allProperties.rows, // Added for visit creation form
                allTenants: allTenants.rows,       // Added for visit creation form
                assignedProjects: assignedProjects.rows,
                agentsUnderBuilder: agentsUnderBuilder, // Added for assigning visits and adding agents
                activeProperties: activeProperties.rows,
                salesLeads: myLeads.rows,
                schedules: schedulesRes.rows,
                salesTasks: tasksRes.rows,
                salesTransactions: transactionsRes.rows,
                myRequirements: myReqsRes.rows,
                requirementSuggestions: mySuggRes.rows
            });
        }
        res.render('agent-dashboard', {
            user: req.session.user,
            visits: myVisits.rows,
                visitRequests: visitRequestsRes.rows,
            myProperties: brokerPropertyGroups.myProperties,
            managedProperties: brokerPropertyGroups.managedProperties,
            allPropertiesList: brokerPropertyGroups.allProperties,
            assignedProperties: assignedProps.rows,
            assignedProjects: assignedProjects.rows,
            allProperties: allProperties.rows, // Added for visit creation form
            allTenants: allTenants.rows,       // Added for visit creation form
            agentsUnderBuilder: agentsUnderBuilder, // Added for assigning visits and adding agents
            activeProperties: activeProperties.rows,
            salesLeads: myLeads.rows,
            schedules: schedulesRes.rows,
            salesTasks: tasksRes.rows,
            salesTransactions: transactionsRes.rows,
            myRequirements: myReqsRes.rows,
            requirementSuggestions: mySuggRes.rows
        });
    });

    router.post('/broker/add-sales-agent', async (req, res) => {
        if (!req.session.user || !['builder', 'broker'].includes(req.session.user.role)) return res.status(403).send('Unauthorized');
        const name = req.body.name || req.body.username;
        const { email, password, phone, role } = req.body;
        const passwordError = validatePassword(password);
        const redirectUrl = req.session.user.role === 'builder' ? '/builder?tab=salesManagement' : '/broker?tab=salesManagement';
        if (passwordError) {
            return res.redirect(redirectUrl + '&error=' + encodeURIComponent(passwordError));
        }

        const targetRole = 'external_sales'; // Brokers can only add Sales Agents
        const hash = await bcrypt.hash(password, 10);
        const uniqueUsername = await generateUniqueUsername(name);
        
        if (RESERVED_USERNAMES.has(uniqueUsername.toLowerCase())) {
            return res.redirect(redirectUrl + '&error=' + encodeURIComponent('This username is reserved and cannot be used.'));
        }

        let nextAccountNumber;
        const resAcc = await pool.query("SELECT MAX(CAST(account_number AS INTEGER)) as max_acc FROM users WHERE role != 'admin' AND account_number ~ '^[0-9]{7}$'");
        nextAccountNumber = (resAcc.rows[0].max_acc || 1000000) + 1;

        try {
            const salesFields = salesAgentInsertFields(req.session.user.id, req.session.user.role);
            const result = await pool.query(
                'INSERT INTO users (name, username, account_number, email, password_hash, role, phone, parent_id, sales_agent_type, parent_type, is_email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE) RETURNING id',
                [name, uniqueUsername, nextAccountNumber.toString(), email, hash, targetRole, phone, req.session.user.id, salesFields.salesAgentType, salesFields.parentType]
            );
            await addToPasswordHistory(result.rows[0].id, hash);
            await invalidateUserPermissionCache(result.rows[0].id);
            if (phone) {
                const loginUrl = `http://${req.headers.host}/login`;
                waService.sendAccountCredentials(phone, name, uniqueUsername, email, password, loginUrl).catch(e => console.error("WA Error:", e));
            }
            // Send email with credentials
            await emailQueue.add('accountCredentialsEmail', { email, name, username: uniqueUsername, password, loginUrl });
        } catch (err) { console.error("Add agent error:", err); }
    res.redirect(redirectUrl);
    });

    // Update per-user permissions
    router.post('/broker/update-permissions', async (req, res) => {
        if (!req.session.user || !['builder', 'broker'].includes(req.session.user.role)) return res.status(403).send('Unauthorized');
        const { target_user_id, can_add_property, can_manage_visits, can_add_lead } = req.body;
        try {
            const check = await pool.query(`
                SELECT id, COALESCE(permissions, '{}'::jsonb) AS permissions
                FROM users 
                WHERE id = $1
                  AND parent_id = $2
                  AND role = 'external_sales'
                  AND COALESCE(sales_agent_type, 'associated') = 'associated'
            `, [target_user_id, req.session.user.id]);
            
            if (check.rows.length > 0) {
                const permissionMap = {
                    can_add_property: 'manage_properties',
                    can_manage_visits: 'manage_visits',
                    can_add_lead: 'manage_sales'
                };
                const submittedPermissions = {
                    can_add_property: can_add_property === 'true',
                    can_manage_visits: can_manage_visits === 'true',
                    can_add_lead: can_add_lead === 'true'
                };
                const permissionNames = Object.values(permissionMap);
                const permissionIdsRes = await pool.query(
                    'SELECT id, name FROM permissions WHERE name = ANY($1::text[])',
                    [permissionNames]
                );
                const permissionIdByName = new Map(permissionIdsRes.rows.map((row) => [row.name, row.id]));
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    for (const [inputName, permissionName] of Object.entries(permissionMap)) {
                        const permissionId = permissionIdByName.get(permissionName);
                        if (!permissionId) continue;
                        const isGranted = submittedPermissions[inputName];
                        await client.query(
                            `INSERT INTO user_permissions (user_id, permission_id, is_granted)
                             VALUES ($1, $2, $3)
                             ON CONFLICT (user_id, permission_id)
                             DO UPDATE SET is_granted = EXCLUDED.is_granted`,
                            [target_user_id, permissionId, isGranted]
                        );
                    }

                    const mergedPermissions = {
                        ...check.rows[0].permissions,
                        ...submittedPermissions
                    };
                    await client.query(
                        'UPDATE users SET permissions = $1 WHERE id = $2',
                        [JSON.stringify(mergedPermissions), target_user_id]
                    );

                    await client.query('COMMIT');
                    await invalidateUserPermissionCache(target_user_id);
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            }
        } catch (err) { console.error("Permission update error:", err); }
        const redirectUrl = req.session.user.role === 'builder' ? '/builder?tab=salesManagement' : '/broker?tab=salesManagement';
        res.redirect(redirectUrl);
    });

    router.post('/broker/assign-visit', validate(visitAssignSchema), salesManagementController.assignVisit);

    // New route for agents to create and assign visits
    router.post('/broker/visits/create-assign', validate(visitCreateAssignSchema), salesManagementController.createAndAssignVisit);

    // New route for agents to assign properties to other agents under the same builder/broker
    router.post('/broker/assign-property-to-agent', salesManagementController.assignPropertyToAgent);

    router.get('/sales', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'external_sales') return res.redirect('/login');
        const permissions = await getUserPermissions(req.session.user.id);
        const salesContext = await getSalesAgentContext(req.session.user.id);
        const managerIds = salesContext.managerIds.length ? salesContext.managerIds : [req.session.user.id];
        const salesScopeIds = await getSalesScopeIds(req.session.user.id);
        req.session.user.sales_agent_type = salesContext.salesAgentType;
        req.session.user.parent_type = salesContext.parentType;
        req.session.user.parent_id = salesContext.parentId || req.session.user.parent_id || null;
        const userId = req.session.user.id;
        const [
            myVisitRows,
            myLeadRows,
            propertyRows,
            corpClientRows,
            corpReqRows,
            scheduleRows,
            visitRequestRows,
            assignedProjectRows,
            taskRows,
            transactionRows,
            managementRequestRows,
            myRequirementRows,
            requirementSuggestionRows
        ] = await Promise.all([
            cachedRows('sales-visits', userId, 20, `SELECT v.*, p.title as property_title, p.locality, p.latitude, p.longitude, p.photos, renter.username as renter_name, renter.phone as renter_phone, renter.email as renter_email, renter.saved_filters, owner.username as owner_name, owner.phone as owner_phone, owner.email as owner_email, a.username as agent_name, parent.username as parent_name FROM visits v JOIN properties p ON v.property_id = p.id JOIN users renter ON v.user_id = renter.id LEFT JOIN users owner ON p.owner_id = owner.id LEFT JOIN users a ON v.agent_id = a.id LEFT JOIN users parent ON a.parent_id = parent.id WHERE v.agent_id = $1 ORDER BY v.scheduled_at ASC`, [userId]),
            cachedRows('sales-leads', userId, 20, `SELECT l.*, u.username as assigned_agent_name FROM leads l LEFT JOIN users u ON l.agent_id = u.id WHERE l.agent_id = $1 ORDER BY l.created_at DESC`, [userId]),
            cachedRows('sales-properties', userId, 20, `SELECT p.id, p.owner_id, p.assigned_broker_id, p.assigned_brokers, p.ownership_type, p.title, p.locality, p.final_price, p.status, p.type, p.listing_type, p.photos, p.size, p.condition, p.listed_at, p.is_matrix_verified, u.username as owner_name, u.phone as owner_phone, u.email as owner_email FROM properties p LEFT JOIN users u ON p.owner_id = u.id WHERE p.owner_id = ANY($1::int[]) OR p.assigned_broker_id = ANY($1::int[]) OR COALESCE(p.assigned_brokers, '{}'::int[]) && $1::int[] ORDER BY p.id DESC LIMIT 100`, [managerIds], { managerIds }),
            cachedRows('sales-corporate-clients', userId, 20, `SELECT id, username, agency_name, email, phone, company_logo, avatar_url FROM users WHERE role = 'corporate' AND rm_id = $1`, [userId]),
            cachedRows('sales-corporate-reqs', userId, 20, `SELECT cr.*, u.agency_name, u.username as corp_name FROM corporate_requirements cr JOIN users u ON cr.corporate_id = u.id WHERE u.rm_id = $1 ORDER BY cr.created_at DESC`, [userId]),
            cachedRows('sales-schedules', userId, 20, `SELECT s.*, l.name as lead_name, l.email as lead_email FROM agent_schedules s LEFT JOIN leads l ON s.reference_id = l.id WHERE s.agent_id = $1 ORDER BY s.scheduled_at ASC`, [userId]),
            cachedRows('sales-visit-requests', userId, 20, `SELECT v.*, p.title as property_title, p.locality, p.photos, u.username as renter_name, u.phone as renter_phone, a.username as agent_name, parent.username as parent_name FROM visits v JOIN properties p ON v.property_id = p.id JOIN users u ON v.user_id = u.id LEFT JOIN users a ON v.agent_id = a.id LEFT JOIN users parent ON a.parent_id = parent.id WHERE (p.owner_id = ANY($1::int[]) OR p.assigned_broker_id = ANY($1::int[]) OR COALESCE(p.assigned_brokers, '{}'::int[]) && $1::int[]) ORDER BY v.created_at DESC`, [managerIds], { managerIds }),
            cachedRows('sales-projects', userId, 30, `SELECT DISTINCT p.*, u.agency_name as builder_name FROM projects p LEFT JOIN project_brokers pb ON p.id = pb.project_id JOIN users u ON p.builder_id = u.id WHERE p.builder_id = ANY($1::int[]) OR pb.broker_id = ANY($1::int[]) ORDER BY p.created_at DESC`, [managerIds], { managerIds }),
            cachedRows('sales-tasks', userId, 20, `SELECT t.*, assignee.username as assignee_name, creator.username as creator_name, p.title as property_title, l.name as lead_name FROM agent_tasks t LEFT JOIN users assignee ON t.assigned_to = assignee.id LEFT JOIN users creator ON t.created_by = creator.id LEFT JOIN properties p ON t.related_property_id = p.id LEFT JOIN leads l ON t.related_lead_id = l.id WHERE t.assigned_to = ANY($1::int[]) OR t.created_by = ANY($1::int[]) ORDER BY t.created_at DESC`, [salesScopeIds], { salesScopeIds }),
            cachedRows('sales-transactions', userId, 20, `SELECT st.*, p.title as property_title FROM sales_transactions st LEFT JOIN properties p ON st.property_id = p.id WHERE st.agent_id = ANY($1::int[]) ORDER BY st.created_at DESC`, [salesScopeIds], { salesScopeIds }),
            salesContext.salesAgentType === 'independent'
                ? cachedRows('sales-management-requests', userId, 20, `SELECT pmr.*, p.title AS property_title, p.locality, p.final_price, owner.username AS owner_name FROM property_management_requests pmr JOIN properties p ON p.id = pmr.property_id JOIN users owner ON owner.id = pmr.owner_id WHERE pmr.agent_id = $1 ORDER BY pmr.created_at DESC`, [userId])
                : Promise.resolve([]),
            cachedRows('sales-my-requirements', userId, 20, `SELECT * FROM corporate_requirements WHERE corporate_id = $1 ORDER BY created_at DESC`, [userId]),
            cachedRows('sales-requirement-suggestions', userId, 20, `SELECT rs.*, p.title as property_title, p.locality, p.final_price, p.type, p.photos, cr.cities as req_cities, cr.property_type as req_type FROM requirement_suggestions rs JOIN properties p ON rs.property_id = p.id JOIN corporate_requirements cr ON rs.requirement_id = cr.id WHERE cr.corporate_id = $1 AND rs.status = 'approved' ORDER BY rs.created_at DESC`, [userId]).catch(() => [])
        ]);
        const myVisits = { rows: myVisitRows };
        const myLeads = { rows: myLeadRows };
        const propertiesList = { rows: propertyRows };
        const salesPropertyGroups = classifyDashboardProperties(propertiesList.rows, req.session.user.id);
        const salesMyPropertyCounts = buildPropertyStatusCounts(salesPropertyGroups.myProperties);
        const salesManagedPropertyCounts = buildPropertyStatusCounts(salesPropertyGroups.managedProperties);
        const corpClientsRes = { rows: corpClientRows };
        const corpReqsRes = { rows: corpReqRows };
        const schedulesRes = { rows: scheduleRows };
        const visitRequestsRes = { rows: visitRequestRows };
        const assignedProjectsRes = { rows: assignedProjectRows };
        const tasksRes = { rows: taskRows };
        const transactionsRes = { rows: transactionRows };
        const managementRequestsRes = { rows: managementRequestRows };
        const myReqsRes = { rows: myRequirementRows };
        const mySuggRes = { rows: requirementSuggestionRows };

        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                user: req.session.user,
                permissions,
                salesAgentType: salesContext.salesAgentType,
                parentType: salesContext.parentType,
                parentId: salesContext.parentId,
                visits: myVisits.rows,
                visitRequests: visitRequestsRes.rows,
                leads: myLeads.rows,
                myProperties: salesPropertyGroups.myProperties,
                managedProperties: salesPropertyGroups.managedProperties,
                allPropertiesList: salesPropertyGroups.allProperties,
                myPropertiesTotal: salesMyPropertyCounts.total,
                myPropertiesActive: salesMyPropertyCounts.active,
                myPropertiesSold: salesMyPropertyCounts.sold,
                myPropertiesRented: salesMyPropertyCounts.rented,
                myPropertiesDraft: salesMyPropertyCounts.draft,
                managedPropertiesCount: salesManagedPropertyCounts.total,
                assignedPropertiesCount: propertiesList.rows.length,
                properties: propertiesList.rows,
                assignedProperties: propertiesList.rows,
                assignedProjects: assignedProjectsRes.rows,
                salesTasks: tasksRes.rows,
                salesTransactions: transactionsRes.rows,
                propertyManagementRequests: managementRequestsRes.rows,
                corporateClients: corpClientsRes.rows,
                corporateRequirements: corpReqsRes.rows,
                schedules: schedulesRes.rows,
                myRequirements: myReqsRes.rows,
                requirementSuggestions: mySuggRes.rows
            });
        }
        res.render('external-sales-dashboard', { 
            user: req.session.user, 
            visits: myVisits.rows, 
            visitRequests: visitRequestsRes.rows,
            leads: myLeads.rows, 
            myProperties: salesPropertyGroups.myProperties,
            managedProperties: salesPropertyGroups.managedProperties,
            allPropertiesList: salesPropertyGroups.allProperties,
            properties: propertiesList.rows, 
            assignedProperties: propertiesList.rows,
            assignedProjects: assignedProjectsRes.rows,
            salesTasks: tasksRes.rows,
            salesTransactions: transactionsRes.rows,
            propertyManagementRequests: managementRequestsRes.rows,
            corporateClients: corpClientsRes.rows, 
            corporateRequirements: corpReqsRes.rows,
            schedules: schedulesRes.rows,
            myRequirements: myReqsRes.rows,
            requirementSuggestions: mySuggRes.rows,
            tab: req.query.tab || 'overview'
        });
    });

    router.get('/external-sales', (req, res) => {
        res.redirect('/sales');
    });

    router.post('/external-sales/update-visit', validate(visitStatusSchema), salesManagementController.updateExternalSalesVisit);

    router.post('/external-sales/add-lead', validate(leadCreateSchema), salesManagementController.addExternalSalesLead);

    router.post('/external-sales/management-request/respond', salesManagementController.respondToManagementRequest);

    router.post('/broker/tasks/create', workManagementController.createManagerTask);

    router.post('/broker/tasks/update', workManagementController.updateManagerTask);

    router.post(['/sales/tasks/update', '/external-sales/tasks/update'], workManagementController.updateExternalSalesTask);

    router.post(['/broker/transactions/add'], workManagementController.createManagerTransaction);

    router.post(['/sales/transactions/add', '/external-sales/transactions/add'], workManagementController.createExternalSalesTransaction);

    router.post('/external-sales/reassign-lead', validate(leadReassignSchema), salesManagementController.reassignExternalSalesLead);

    router.post('/external-sales/update-lead-status', validate(leadStatusSchema), salesManagementController.updateExternalSalesLeadStatus);

    router.post('/external-sales/send-email', async (req, res) => {
        if (!req.session.user || !['external_sales', 'broker', 'builder'].includes(req.session.user.role)) return res.status(403).send('Unauthorized');
        const redirectBase = req.session.user.role === 'builder' ? '/builder?tab=salesManagement' : (req.session.user.role === 'broker' ? '/broker?tab=salesManagement' : '/external-sales');
        const sep = redirectBase.includes('?') ? '&' : '?';
        try {
            await emailQueue.add('agentEmail', { 
                recipientEmail: req.body.recipientEmail, 
                templateType: req.body.templateType, 
                templateData: { name: req.body.recipientName, agentName: req.session.user.username, propertyTitle: req.body.propertyTitle || 'a property', visitTime: req.body.visitTime || null } 
            });
            res.redirect(`${redirectBase}${sep}message=Email+Sent+Successfully`);
        } catch (err) { res.redirect(`${redirectBase}${sep}error=Failed+to+send+email`); }
    });

    router.post('/external-sales/schedule/add', workManagementController.addSchedule);

    router.post('/external-sales/schedule/update', workManagementController.updateSchedule);

    router.post('/external-sales/schedule/delete', workManagementController.deleteSchedule);

    router.get('/corporate', corporateWorkflowController.corporateDashboard);

    router.post('/corporate/add-subordinate', corporateWorkflowController.addSubordinate);

    router.post('/corporate/requirements/add', corporateWorkflowController.addCorporateRequirement);

    router.post('/requirements/add', corporateWorkflowController.addSharedRequirement);

    router.post('/requirements/user-delete', corporateWorkflowController.deleteUserRequirement);

    router.post('/corporate/profile/update', upload.single('company_logo'), corporateWorkflowController.updateCorporateProfile);

    // Owner: Securely assign property to a local broker only
    router.post('/owner/assign-broker', async (req, res) => {
        if (!req.session.user || req.session.user.role !== 'owner') return res.status(403).send('Unauthorized');
        const { property_id, broker_id } = req.body;
        try {
            // 1. Verify property belongs to owner and get its locality
            const propRes = await pool.query('SELECT locality FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.session.user.id]);
            if (propRes.rows.length === 0) return res.redirect('/owner?error=Property+not+found+or+unauthorized');
            const propertyLocality = propRes.rows[0].locality;

            // 2. Verify broker's operating locality
            const brokerRes = await pool.query("SELECT id, locality, role FROM users WHERE id = $1 AND role IN ('broker', 'external_sales')", [broker_id]);
            if (brokerRes.rows.length === 0) return res.redirect('/owner?error=Selected+broker+not+found');
            const brokerLocality = brokerRes.rows[0].locality || '';
            const brokerRole = brokerRes.rows[0].role;

            if (brokerRole !== 'external_sales') {
                const brokerLocalities = brokerLocality.split(',').map(l => l.trim().toLowerCase());
                if (!brokerLocalities.includes(propertyLocality.trim().toLowerCase())) {
                    return res.redirect('/owner?error=' + encodeURIComponent('Broker locality mismatch for ' + propertyLocality));
                }
            }

            // 3. Assign
            await pool.query('UPDATE properties SET assigned_broker_id = COALESCE(assigned_broker_id, $1), assigned_brokers = array_append(COALESCE(assigned_brokers, \'{}\'), $1) WHERE id = $2 AND NOT ($1 = ANY(COALESCE(assigned_brokers, \'{}\')))', [broker_id, property_id]);
            await syncPropertyAssignmentsForProperty({ propertyId: property_id });
            res.redirect('/owner?message=Broker+assigned+successfully');
        } catch (err) { console.error("Error assigning broker:", err); res.redirect('/owner?error=Server+error+assigning+broker'); }
    });

    // --- Contact & Report Routes ---
    router.get('/contact', (req, res) => {
        res.render('contact', { user: req.session.user || null, pageTitle: "Contact Us", query: req.query });
    });

    router.post('/contact', async (req, res) => {
        try {
            const phone = req.body.phone || null;
            const topic = req.body.topic || null;
            await pool.query(
                'INSERT INTO contact_messages (name, email, phone, topic, message) VALUES ($1, $2, $3, $4, $5)',
                [req.body.name, req.body.email, phone, topic, req.body.message]
            );
            res.redirect('/contact?message=Message+sent+successfully');
        } catch (e) {
            console.error("Contact Form Error:", e);
            res.redirect('/contact?error=Failed+to+send+message');
        }
    });

    router.get('/report', (req, res) => {
        res.render('report', { user: req.session.user || null, pageTitle: "Report an Issue", query: req.query });
    });

    router.post('/report', async (req, res) => {
        const userId = req.session.user ? req.session.user.id : null;
        try {
            await pool.query('INSERT INTO reports (user_id, reported_username, reason, description) VALUES ($1, $2, $3, $4)', [userId, req.body.reported_username || null, req.body.reason, req.body.description]);
            res.redirect('/report?message=Report+submitted+successfully');
        } catch (e) {
            console.error("Report Form Error:", e);
            res.redirect('/report?error=Failed+to+submit+report');
        }
    });

    return router;
};
