const express = require('express');
const pool = require('./db');
const { getSalesAgentContext } = require('./sales-agent-utils');
const { isOwnerProfileRole, normalizeStandardProfileUser } = require('./profile-utils');
const { canManageProperty } = require('./authorization-service');
const { syncPropertyAssignmentsForProperty } = require('./property-assignment-service');
const validate = require('./validate');
const { ownerPropertyEditSchema } = require('./validators/mutation-schemas');

const PROPERTY_FACTS_MARKER = '--- Property Facts ---';

function buildPropertyFactsBlock({
    configuration,
    floor_number,
    total_floors,
    overlooking,
    property_age,
    negotiable
}) {
    const lines = [];
    const add = (label, value) => {
        const text = String(value || '').trim();
        if (text) lines.push(`${label}: ${text}`);
    };

    add('Configuration', configuration);
    add('Floor Number', floor_number);
    add('Total Floors', total_floors);
    add('Overlooking', overlooking);
    add('Property Age', property_age);

    const negotiableText = String(negotiable || '').trim().toLowerCase();
    if (negotiableText === 'on' || negotiableText === 'true' || negotiableText === 'yes') {
        lines.push('Negotiable: Yes');
    }

    return lines.length ? `${PROPERTY_FACTS_MARKER}\n${lines.join('\n')}` : '';
}

module.exports = function(upload) {
    const router = express.Router();

    // Middleware to ensure user is an owner
    router.use(async (req, res, next) => {
        const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.user || !isOwnerProfileRole(req.session.user.role)) {
            if (wantsJson) return res.status(401).json({ error: 'Unauthorized' });
            return res.redirect('/login');
        }
        req.session.user = normalizeStandardProfileUser(req.session.user);
        next();
    });

    // GET /owner - Owner Dashboard
    router.get('/', async (req, res) => {
        const result = await pool.query(`
            SELECT p.*, u.username as broker_name 
            FROM properties p 
            LEFT JOIN users u ON p.assigned_broker_id = u.id 
            WHERE p.owner_id = $1
            ORDER BY p.created_at DESC
        `, [req.session.user.id]);
        const props = result.rows;
        
        let totalInquiries = 0;
        
        const visitsRes = await pool.query(`
            SELECT v.*, p.title as property_title, p.photos, u.username as renter_name,
                   a.username as agent_name, parent.username as parent_name
            FROM visits v 
            JOIN properties p ON v.property_id = p.id 
            JOIN users u ON v.user_id = u.id
            LEFT JOIN users a ON v.agent_id = a.id
            LEFT JOIN users parent ON a.parent_id = parent.id
            WHERE p.owner_id = $1
            ORDER BY v.scheduled_at DESC
        `, [req.session.user.id]);

        // Fetch active conversation threads explicitly for owner
        const convsRes = await pool.query(`
            SELECT property_id, buyer_id, last_message, last_message_at, unread_count_owner 
            FROM property_conversations
            WHERE owner_id = $1::int AND NOT ($1::int = ANY(COALESCE(deleted_by, '{}'::int[])))
        `, [req.session.user.id]);

        for (let p of props) {
            p.inquiry_count = convsRes.rows.filter(c => c.property_id === p.id).length;
        }
        totalInquiries = convsRes.rows.length;
        
        let brokersRes;
        try {
            brokersRes = await pool.query(`
                SELECT u.id, u.username, u.email, u.role, u.account_number, u.locality, u.avatar_url,
                       AVG(ur.rating) as rating, 
                       COUNT(ur.id) as review_count 
                FROM users u 
                LEFT JOIN user_reviews ur ON u.id = ur.target_user_id 
                WHERE u.role IN ('broker', 'agent')
                   OR (u.role = 'external_sales' AND COALESCE(u.sales_agent_type, CASE WHEN u.parent_id IS NULL THEN 'independent' ELSE 'associated' END) = 'independent')
                GROUP BY u.id, u.username, u.email, u.role, u.account_number, u.locality, u.avatar_url
            `);
        } catch (e) {
            brokersRes = await pool.query("SELECT id, username, email, role, account_number, locality, avatar_url FROM users WHERE role IN ('broker', 'agent') OR (role = 'external_sales' AND COALESCE(sales_agent_type, CASE WHEN parent_id IS NULL THEN 'independent' ELSE 'associated' END) = 'independent')");
        }
        
        const reqsRes = await pool.query("SELECT * FROM corporate_requirements WHERE corporate_id = $1 ORDER BY created_at DESC", [req.session.user.id]);
        let suggRes = { rows: [] };
        try {
            suggRes = await pool.query(`
                SELECT rs.*, p.title as property_title, p.locality, p.final_price, p.type, p.photos, cr.cities as req_cities, cr.property_type as req_type
                FROM requirement_suggestions rs
                JOIN properties p ON rs.property_id = p.id
                JOIN corporate_requirements cr ON rs.requirement_id = cr.id
                WHERE cr.corporate_id = $1 AND rs.status = 'approved'
                ORDER BY rs.created_at DESC
            `, [req.session.user.id]);
        } catch(e) {}

        const managementRequestsRes = await pool.query(`
            SELECT pmr.*, p.title AS property_title, p.locality, p.final_price, agent.username AS agent_name
            FROM property_management_requests pmr
            JOIN properties p ON p.id = pmr.property_id
            JOIN users agent ON agent.id = pmr.agent_id
            WHERE pmr.owner_id = $1
            ORDER BY pmr.created_at DESC
        `, [req.session.user.id]);

        const payload = {
            properties: props, 
            totalInquiries,
            visits: visitsRes.rows,
            brokers: brokersRes.rows,
            myRequirements: reqsRes.rows,
            requirementSuggestions: suggRes.rows,
            managementRequests: managementRequestsRes.rows
        };

        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json(payload);
        }

        res.render('owner-dashboard', payload);
    });

    router.post('/rate-broker', async (req, res) => {
        const { broker_id, rating, comment } = req.body;
        try {
            await pool.query(`
                INSERT INTO user_reviews (target_user_id, reviewer_id, rating, comment) 
                VALUES ($1, $2, $3, $4)
            `, [broker_id, req.session.user.id, rating, comment]);
        } catch (e) {
            console.error('Error saving broker review:', e);
        }
        res.redirect('/owner');
    });

    router.post('/property/:id/assign-broker', async (req, res) => {
        const { broker_id } = req.body;
        const property_id = req.params.id;
        
        try {
            if (!broker_id) {
                // Feature: Easily remove all assigned brokers to revert to "Self Managed"
                await pool.query('UPDATE properties SET assigned_broker_id = NULL, assigned_brokers = \'{}\' WHERE id = $1 AND owner_id = $2', [property_id, req.session.user.id]);
                await syncPropertyAssignmentsForProperty({ propertyId: property_id });
                return res.redirect('/owner?message=Broker+removed');
            }

            // 1. Verify property belongs to owner and get its locality
            const propRes = await pool.query('SELECT locality FROM properties WHERE id = $1 AND owner_id = $2', [property_id, req.session.user.id]);
            if (propRes.rows.length === 0) return res.redirect('/owner?error=Property+not+found+or+unauthorized');
            const propertyLocality = propRes.rows[0].locality;

            // 2. Verify broker's operating locality
            const brokerRes = await pool.query("SELECT id, locality, role, COALESCE(sales_agent_type, CASE WHEN parent_id IS NULL THEN 'independent' ELSE 'associated' END) AS sales_agent_type FROM users WHERE id = $1 AND (role IN ('broker', 'agent') OR (role = 'external_sales' AND COALESCE(sales_agent_type, CASE WHEN parent_id IS NULL THEN 'independent' ELSE 'associated' END) = 'independent'))", [broker_id]);
            if (brokerRes.rows.length === 0) return res.redirect('/owner?error=Selected+broker+not+found');
            const brokerLocality = brokerRes.rows[0].locality || '';
            const brokerRole = brokerRes.rows[0].role;
            const salesAgentType = brokerRes.rows[0].sales_agent_type;

            // Enforce strict locality matching!
            if (brokerRole !== 'external_sales' && brokerLocality) {
                const brokerLocalities = brokerLocality.split(',').map(l => l.trim().toLowerCase());
                if (!brokerLocalities.includes(propertyLocality.trim().toLowerCase())) {
                    return res.redirect('/owner?error=' + encodeURIComponent('Broker locality mismatch for ' + propertyLocality));
                }
            }

            if (brokerRole === 'external_sales' && salesAgentType === 'independent') {
                await pool.query(`
                    INSERT INTO property_management_requests (property_id, owner_id, agent_id, status)
                    VALUES ($1, $2, $3, 'pending')
                `, [property_id, req.session.user.id, broker_id]);
                await pool.query(
                    'INSERT INTO notifications (user_id, content, link) VALUES ($1, $2, $3)',
                    [broker_id, 'New property management request received.', '/sales']
                ).catch(() => {});
                return res.redirect('/owner?message=Management+request+sent');
            }

            // 3. Assign to list
            await pool.query('UPDATE properties SET assigned_broker_id = COALESCE(assigned_broker_id, $1), assigned_brokers = array_append(COALESCE(assigned_brokers, \'{}\'), $1) WHERE id = $2 AND NOT ($1 = ANY(COALESCE(assigned_brokers, \'{}\')))', [broker_id, property_id]);
            await syncPropertyAssignmentsForProperty({ propertyId: property_id });
            res.redirect('/owner?message=Broker+assigned+successfully');
        } catch (err) { 
            console.error("Error assigning broker:", err); 
            res.redirect('/owner?error=Server+error+assigning+broker'); 
        }
    });

    router.post('/property/:id/remove-broker', async (req, res) => {
        const { broker_id } = req.body;
        const property_id = req.params.id;
        try {
            await pool.query('UPDATE properties SET assigned_brokers = array_remove(assigned_brokers, $1) WHERE id = $2 AND owner_id = $3', [broker_id, property_id, req.session.user.id]);
            await pool.query(`
                UPDATE properties 
                SET assigned_broker_id = CASE 
                    WHEN assigned_broker_id = $1 THEN (assigned_brokers)[1]
                    ELSE assigned_broker_id 
                END
                WHERE id = $2 AND owner_id = $3
            `, [broker_id, property_id, req.session.user.id]);
            await syncPropertyAssignmentsForProperty({ propertyId: property_id });
            res.redirect('/owner?message=Broker+removed+successfully');
        } catch (err) { console.error("Error removing broker:", err); res.redirect('/owner?error=Server+error+removing+broker'); }
    });

    router.post(['/property/edit', '/owner/property/edit'], validate(ownerPropertyEditSchema), async (req, res) => {
        if (!req.session.user) return res.status(403).send('Unauthorized');
        
        const propId = req.body.id;
        const userId = req.session.user.id;
        const { 
            title, locality, listingType, contact, final_price, size, type, typeOther, 
            condition, furnishing, parking, bathrooms, facing, configuration,
            pg_sharing, pg_tenant, pg_food, pg_amenities
        } = req.body;
        
        const finalType = type === 'Others' ? typeOther : type;
        const finalListingType = listingType || 'rent';

        const propertyFactsBlock = buildPropertyFactsBlock({
            configuration,
            floor_number: req.body.floor_number,
            total_floors: req.body.total_floors,
            overlooking: req.body.overlooking,
            property_age: req.body.property_age,
            negotiable: req.body.negotiable
        });
        let finalCondition = [condition || '', propertyFactsBlock].filter(Boolean).join('\n\n');
        if (finalListingType === 'pg') {
            finalCondition += `${finalCondition ? '\n\n' : ''}--- Overview ---\nRoom Sharing: ${pg_sharing || 'N/A'}\nTenant: ${pg_tenant || 'N/A'}\nFood: ${pg_food || 'N/A'}\nAmenities: ${pg_amenities || 'None'}`;
        } else {
            finalCondition += `${finalCondition ? '\n\n' : ''}--- Overview ---\nFurnishing: ${furnishing || 'N/A'}\nParking: ${parking || 'N/A'}\nBathrooms: ${bathrooms || 'N/A'}\nFacing: ${facing || 'N/A'}`;
        }

        try {
            const propertyRes = await pool.query(
                'SELECT owner_id, assigned_broker_id, assigned_brokers FROM properties WHERE id = $1',
                [propId]
            );
            if (propertyRes.rows.length === 0) {
                return res.redirect(req.get('Referer') || '/owner?error=Property+not+found');
            }

            const property = propertyRes.rows[0];
            const isAuthorized = await canManageProperty(req.session.user, { id: propId, ...property });

            if (!isAuthorized) {
                return res.status(403).send('Unauthorized');
            }

            await pool.query(
                `UPDATE properties 
                 SET title = $1, locality = $2, listing_type = $3, contact = $4, final_price = $5, size = $6, type = $7, condition = $8,
                     furnishing = $9, parking = $10, bathrooms = $11, facing = $12
                 WHERE id = $13 AND owner_id = $14`,
                [title, locality, finalListingType, contact, final_price, size, finalType, finalCondition, 
                 furnishing, parking, bathrooms || null, facing, propId, property.owner_id]
            );
            res.redirect(req.get('Referer') || '/owner?message=Property+updated+successfully');
        } catch (err) {
            console.error('Error updating property:', err);
            res.redirect(req.get('Referer') || '/owner?error=Server+error+updating+property');
        }
    });

    router.post('/property/:id/declare-ownership', async (req, res) => {
        const propId = req.params.id;
        const userId = req.session.user.id;

        try {
            // Ensure the user owns the property before updating
            await pool.query(
                'UPDATE properties SET ownership_declaration = TRUE WHERE id = $1 AND owner_id = $2',
                [propId, userId]
            );
        } catch (err) {
            console.error('Error declaring ownership:', err);
        }

        res.redirect('/owner');
    });

    return router;
};
