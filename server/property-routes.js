const express = require('express');
const pool = require('./db');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { getSalesAgentContext } = require('./sales-agent-utils');
const { isOwnerProfileRole, isStandardProfileRole } = require('./profile-utils');
const { canCreateInquiry, requirePropertyPolicy } = require('./authorization-service');
const { requireCsrf } = require('./csrf-protection');
const { createLeadForInquiry, logContactInquiry } = require('./inquiry-service');
const { syncPropertyAssignmentsForProperty } = require('./property-assignment-service');
const validate = require('./validate');
const {
    contactRequestSchema,
    propertyAddSchema,
    propertyDeleteSchema,
    propertyReviewSchema
} = require('./validators/mutation-schemas');

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

const OWNERSHIP_SELF_OWNED = 'self_owned';
const OWNERSHIP_MANAGED = 'managed';
const OWNERSHIP_MANAGED_FOR_OWNER = 'managed_for_owner';
const OWNERSHIP_BROKER_MANAGED = 'broker_managed';
const OWNERSHIP_SALES_MANAGED = 'sales_managed';
const OWNERSHIP_BUILDER_INVENTORY = 'builder_inventory';
const SELF_OWNERSHIP_ROLES = new Set(['admin', 'support', 'builder', 'broker', 'agent', 'external_sales']);

function isTruthy(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value || '').trim().toLowerCase();
    return ['true', '1', 'on', 'yes'].includes(normalized);
}

function normalizeEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
}

function normalizeText(value) {
    const normalized = String(value || '').trim();
    return normalized || null;
}

async function buildUniqueUsername(baseValue) {
    const base = String(baseValue || 'owner')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'owner';

    let candidate = base;
    let attempt = 0;
    while (attempt < 10) {
        const existing = await pool.query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [candidate]);
        if (existing.rows.length === 0) return candidate;
        attempt += 1;
        candidate = `${base.slice(0, 18)}_${Math.random().toString(36).slice(2, 2 + attempt + 2)}`;
    }

    return `${base.slice(0, 16)}_${Date.now().toString().slice(-6)}`;
}

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

module.exports = function(upload, transporter) {
    const router = express.Router();
    const contactRequestLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `${req.session && req.session.user ? req.session.user.id : ipKeyGenerator(req.ip)}:${req.params.id || 'property'}`,
        message: 'Too many contact requests. Please try again later.'
    });

    // Property Details & Reviews
    router.get('/:id', async (req, res) => {
        const propId = req.params.id;
        
        let propRes;
        try {
            propRes = await pool.query(`
                SELECT p.*,
                       o.username as owner_name, o.email as owner_email, o.phone as owner_phone, o.role as owner_role,
                       (SELECT COUNT(DISTINCT user_id) FROM recently_viewed WHERE property_id = p.id) as view_count
                FROM properties p 
                LEFT JOIN users o ON p.owner_id = o.id
                WHERE p.id = $1
            `, [propId]);
        } catch (e) {
            propRes = await pool.query('SELECT p.*, o.username as owner_name, o.email as owner_email, o.phone as owner_phone, o.role as owner_role, (SELECT COUNT(DISTINCT user_id) FROM recently_viewed WHERE property_id = p.id) as view_count FROM properties p LEFT JOIN users o ON p.owner_id = o.id WHERE p.id = $1', [propId]);
        }
        
        if (propRes.rows.length === 0) return res.redirect('/');

        const property = propRes.rows[0];
        
        // Fetch multiple assignees
        let assignees = [];
        try {
            const assigneesRes = await pool.query(`
                SELECT id, username as broker_name, phone as broker_phone, role as broker_role, email as broker_email, agency_name,
                       (SELECT AVG(rating) FROM user_reviews WHERE target_user_id = users.id) as broker_rating,
                       (SELECT COUNT(id) FROM user_reviews WHERE target_user_id = users.id) as broker_review_count
                FROM users 
                WHERE id = ANY(COALESCE($1, '{}'::int[])) OR id = $2
            `, [property.assigned_brokers, property.assigned_broker_id]);
            assignees = assigneesRes.rows;
            if (assignees.length > 0) {
                property.assigned_broker_id = assignees[0].id;
                property.broker_name = assignees[0].broker_name;
                property.broker_phone = assignees[0].broker_phone;
                property.broker_role = assignees[0].broker_role;
                property.broker_rating = assignees[0].broker_rating;
                property.broker_review_count = assignees[0].broker_review_count;
            }
        } catch(e) { console.error("Error fetching assignees", e); }
        property.assignees = assignees;

        let isFavorite = false;
        let messagesRes = { rows: [] };

        if (req.session.user) {
            try {
                await pool.query(
                    `INSERT INTO recently_viewed (user_id, property_id, viewed_at) 
                     VALUES ($1, $2, NOW()) 
                     ON CONFLICT (user_id, property_id) 
                     DO UPDATE SET viewed_at = NOW()`,
                    [req.session.user.id, propId]
                );
            } catch (e) { console.error("Error recording view:", e); }

            const updateRes = await pool.query(
                "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND link = $2 RETURNING id", 
                [req.session.user.id, `/property/${propId}`]
            );
            if (updateRes.rowCount > 0) {
                res.locals.chatUnreadCount = Math.max(0, (res.locals.chatUnreadCount || 0) - updateRes.rowCount);
            }

            const favRes = await pool.query('SELECT 1 FROM favorites WHERE user_id = $1 AND property_id = $2', [req.session.user.id, propId]);
            isFavorite = favRes.rows.length > 0;

            messagesRes = await pool.query('SELECT * FROM messages WHERE property_id = $1 AND tenant_username = $2 ORDER BY created_at ASC', [propId, req.session.user.username]);

        }

        // Extract Overview Details for UI display
        let overview = {
            furnishing: 'N/A',
            parking: 'N/A',
            bathrooms: 'N/A',
            facing: 'N/A'
        };
        let cleanCondition = property.condition || '';
        if (cleanCondition.includes('--- Overview ---')) {
            const parts = cleanCondition.split('--- Overview ---');
            cleanCondition = parts[0].trim();
            const overviewStr = parts[1] || '';
            
            if (property.listing_type === 'pg') {
                const shareMatch = overviewStr.match(/Room Sharing:\s*(.*)/);
                if (shareMatch) overview.furnishing = shareMatch[1].trim();
                const tenantMatch = overviewStr.match(/Tenant:\s*(.*)/);
                if (tenantMatch) overview.parking = tenantMatch[1].trim();
                const foodMatch = overviewStr.match(/Food:\s*(.*)/);
                if (foodMatch) overview.bathrooms = foodMatch[1].trim();
                const amenMatch = overviewStr.match(/Amenities:\s*(.*)/);
                if (amenMatch) overview.facing = amenMatch[1].trim();
            } else {
                const furMatch = overviewStr.match(/Furnishing:\s*(.*)/);
                if (furMatch) overview.furnishing = furMatch[1].trim();
                const parkMatch = overviewStr.match(/Parking:\s*(.*)/);
                if (parkMatch) overview.parking = parkMatch[1].trim();
                const bathMatch = overviewStr.match(/Bathrooms:\s*(.*)/);
                if (bathMatch) overview.bathrooms = bathMatch[1].trim();
                const faceMatch = overviewStr.match(/Facing:\s*(.*)/);
                if (faceMatch) overview.facing = faceMatch[1].trim();
            }
        }
        property.clean_condition = cleanCondition;
        property.overview = overview;

        let reviews = [];
        if (property.assigned_broker_id) {
            try {
                const reviewsRes = await pool.query(`
                    SELECT ur.rating, ur.comment, u.username 
                    FROM user_reviews ur 
                    JOIN users u ON ur.reviewer_id = u.id 
                    WHERE ur.target_user_id = $1 
                    ORDER BY ur.created_at DESC
                `, [property.assigned_broker_id]);
                reviews = reviewsRes.rows;
            } catch (e) {
                console.error("Error fetching agent reviews:", e);
            }
        }

        if (property.listing_type === 'sale') {
            res.render('property-sale', { 
                property: property, 
                reviews: reviews,
                messages: messagesRes.rows,
                isFavorite,
                query: req.query
            });
        } else {
            res.render('Property', { 
                property: property, 
                reviews: reviews,
                messages: messagesRes.rows,
                isFavorite,
                query: req.query
            });
        }
    });

    router.post('/:id/request-contact', contactRequestLimiter, requireCsrf, validate(contactRequestSchema), requirePropertyPolicy('inquire', (req) => req.params.id), async (req, res) => {
        const propId = req.params.id;
        const requester_email = req.session.user.email || req.body.requester_email;

        if (!requester_email || typeof requester_email !== 'string' || requester_email.includes('..') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requester_email)) {
            return res.redirect(`/property/${propId}?error=Invalid+email+address+provided`);
        }
        
        try {
            const propRes = await pool.query(`
                SELECT p.id, p.title, p.locality, p.listing_type, p.owner_id, p.assigned_broker_id, p.assigned_brokers,
                       u.id as broker_id, u.username as broker_name, u.email as broker_email, u.phone as broker_phone,
                       o.id as owner_user_id, o.username as owner_name, o.email as owner_email, o.phone as owner_phone
                FROM properties p
                LEFT JOIN users u ON p.assigned_broker_id = u.id
                LEFT JOIN users o ON p.owner_id = o.id
                WHERE p.id = $1
            `, [propId]);
            
            if (propRes.rows.length > 0) {
                const p = propRes.rows[0];
                const canInquire = await canCreateInquiry(req.session.user, p);
                if (!canInquire) return res.redirect(`/property/${propId}?error=You+already+manage+this+property`);

                let contactName = p.broker_name || p.owner_name;
                let contactEmail = p.broker_email || p.owner_email;
                let contactPhone = p.broker_phone || p.owner_phone || 'Not provided';
                const managerId = p.broker_id || p.owner_user_id || null;

                await logContactInquiry({
                    propertyId: p.id,
                    requesterId: req.session.user.id,
                    requesterEmail: requester_email,
                    managerId,
                    channel: 'contact_request',
                    req
                });
                await createLeadForInquiry({
                    managerId,
                    requester: req.session.user,
                    property: p,
                    preferencesPrefix: 'Contact request'
                });
                
                let emailText = `Hello,\n\nYou requested the contact details for the property: "${p.title}" located in ${p.locality}.\n\n`;
                emailText += `Here are the details of the person managing this property:\n`;
                emailText += `Name: ${contactName}\n`;
                emailText += `Email: ${contactEmail}\n`;
                emailText += `Phone: ${contactPhone}\n\n`;
                emailText += `Best regards,\nMatrixSpaces Team`;

                if (transporter) {
                    const info = await transporter.sendMail({
                        from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
                        to: requester_email,
                        subject: `Contact Details for ${p.title}`,
                        text: emailText
                    });
                    const nodemailer = require('nodemailer');
                    console.log("Contact details sent. Preview URL: %s", nodemailer.getTestMessageUrl(info));
                }
            }
        } catch (e) { console.error("Error requesting contact:", e); }
        res.redirect(`/property/${propId}?message=Contact+details+sent+to+your+email`);
    });

    router.post('/:id/review', validate(propertyReviewSchema), (req, res, next) => {
        if (!req.session.user) return res.redirect('/login');
        next();
    }, async (req, res) => {
        const { rating, comment } = req.body;
        await pool.query(
            'INSERT INTO reviews (property_id, user_id, rating, comment) VALUES ($1, $2, $3, $4)',
            [req.params.id, req.session.user.id, rating, comment]
        );
        res.redirect(`/property/${req.params.id}`);
    });

    router.post('/add', upload.array('photos', 20), validate(propertyAddSchema), (req, res, next) => {
        if (!req.session.user) return res.redirect('/login');
        next();
    }, async (req, res) => {
        const { 
            title, locality, contact, lat, lng, latitude, longitude, type, typeOther, 
            listingType, final_price, size, condition, owner_name, owner_mobile, owner_email, isOwner, ownership_declaration,
            furnishing, parking, bathrooms, facing,
            configuration, floor_number, total_floors, overlooking, property_age, negotiable,
            pg_sharing, pg_tenant, pg_food, pg_amenities
        } = req.body;

        const finalType = type === 'Others' ? typeOther : type;
        const finalListingType = listingType || 'rent';

        const propertyFactsBlock = buildPropertyFactsBlock({
            configuration,
            floor_number,
            total_floors,
            overlooking,
            property_age,
            negotiable
        });
        let finalCondition = [condition || '', propertyFactsBlock].filter(Boolean).join('\n\n');
        if (finalListingType === 'pg') {
            finalCondition += `${finalCondition ? '\n\n' : ''}--- Overview ---\nRoom Sharing: ${pg_sharing || 'N/A'}\nTenant: ${pg_tenant || 'N/A'}\nFood: ${pg_food || 'N/A'}\nAmenities: ${pg_amenities || 'None'}`;
        } else {
            finalCondition += `${finalCondition ? '\n\n' : ''}--- Overview ---\nFurnishing: ${furnishing || 'N/A'}\nParking: ${parking || 'N/A'}\nBathrooms: ${bathrooms || 'N/A'}\nFacing: ${facing || 'N/A'}`;
        }

        const photoFiles = req.files ? req.files.map(f => f.location || f.key || f.filename) : [];
        const coordinates = normalizeSubmittedCoordinates(lat, lng, latitude, longitude);
        
        const userRole = String(req.session.user.role || '').toLowerCase();
        const loggedInUserIsOwner = isStandardProfileRole(userRole) || isTruthy(isOwner);
        const ownershipType = loggedInUserIsOwner
            ? OWNERSHIP_SELF_OWNED
            : userRole === 'broker'
                ? OWNERSHIP_BROKER_MANAGED
                : userRole === 'builder'
                    ? OWNERSHIP_MANAGED_FOR_OWNER
                    : userRole === 'external_sales' || userRole === 'agent'
                        ? OWNERSHIP_SALES_MANAGED
                        : OWNERSHIP_MANAGED_FOR_OWNER;
        const normalizedOwnerName = normalizeText(owner_name);
        const normalizedOwnerMobile = normalizeText(owner_mobile);
        const normalizedOwnerEmail = normalizeEmail(owner_email);
        const normalizedContact = normalizeText(contact);

        let ownerId = req.session.user.id;
        let isNewOwner = false;
        let tempPassword = null;
        let targetOwnerEmail = req.session.user.email || normalizedOwnerEmail;
        
        if (!loggedInUserIsOwner && SELF_OWNERSHIP_ROLES.has(userRole)) {
            targetOwnerEmail = normalizedOwnerEmail;
            try {
                const existing = await pool.query('SELECT id, name, phone FROM users WHERE email = $1', [targetOwnerEmail]);
                if (existing.rows.length > 0) {
                    ownerId = existing.rows[0].id;
                    if ((normalizedOwnerName && !existing.rows[0].name) || (normalizedOwnerMobile && !existing.rows[0].phone)) {
                        await pool.query(
                            `UPDATE users
                             SET name = COALESCE(NULLIF(name, ''), $1),
                                 phone = COALESCE(NULLIF(phone, ''), $2)
                             WHERE id = $3`,
                            [normalizedOwnerName, normalizedOwnerMobile, ownerId]
                        );
                    }
                } else {
                    isNewOwner = true;
                    tempPassword = crypto.randomBytes(6).toString('hex') + 'A1!';
                    const hash = await bcrypt.hash(tempPassword, 10);
                    const ownerUsername = await buildUniqueUsername(normalizedOwnerName || targetOwnerEmail.split('@')[0]);
                    const newUser = await pool.query(
                        `INSERT INTO users (username, name, email, password_hash, role, phone, has_random_password)
                         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                         RETURNING id`,
                        [ownerUsername, normalizedOwnerName, targetOwnerEmail, hash, 'owner', normalizedOwnerMobile]
                    );
                    ownerId = newUser.rows[0].id;
                }
            } catch (e) {
                console.error("Error linking owner:", e);
            }
        }

        const newProp = await pool.query(
            `INSERT INTO properties (
                owner_id, title, locality, contact, latitude, longitude, status, type, 
                listing_type, final_price, size, condition, photos, ownership_declaration, ownership_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id`,
            [ownerId, title, locality, normalizedContact, coordinates ? coordinates.lat : null, coordinates ? coordinates.lng : null, 'listed', finalType, finalListingType, final_price || null, size || null, finalCondition, photoFiles, isTruthy(ownership_declaration), ownershipType]
        );

        if (!loggedInUserIsOwner && ['external_sales', 'builder', 'broker'].includes(req.session.user.role)) {
            let managerId = req.session.user.id;
            if (req.session.user.role === 'external_sales') {
                const salesContext = await getSalesAgentContext(req.session.user.id);
                managerId = salesContext.salesAgentType === 'associated' && salesContext.parentId ? salesContext.parentId : req.session.user.id;
            }
            await pool.query(
                `UPDATE properties
                 SET assigned_broker_id = COALESCE(assigned_broker_id, $1),
                     assigned_brokers = CASE
                         WHEN $1 = ANY(COALESCE(assigned_brokers, '{}'::int[])) THEN assigned_brokers
                         ELSE array_append(COALESCE(assigned_brokers, '{}'::int[]), $1)
                     END
                 WHERE id = $2`,
                [managerId, newProp.rows[0].id]
            );
            await syncPropertyAssignmentsForProperty({ propertyId: newProp.rows[0].id });
        }
        
        const allUsers = await pool.query('SELECT id FROM users WHERE id != $1', [req.session.user.id]);
        for (let u of allUsers.rows) {
            await pool.query('INSERT INTO notifications (user_id, content, link) VALUES ($1, $2, $3)',
                [u.id, `New property listed in ${locality}: ${title}`, `/property/${newProp.rows[0].id}`]);
        }
        
        // Send Background Email to Owner if listed by a broker/builder on their behalf
        if (!loggedInUserIsOwner && ['external_sales', 'builder', 'broker'].includes(req.session.user.role) && targetOwnerEmail && !targetOwnerEmail.endsWith('@matrixspaces.local') && transporter) {
            const loginUrl = `http://${req.headers.host}/login`;
            const propertyUrl = `http://${req.headers.host}/property/${newProp.rows[0].id}`;
            let emailText = `Hello,\n\nYour property "${title}" located in ${locality} has been successfully listed on your behalf by our sales team!\n\nYou can view your live property here: ${propertyUrl}\n\n`;
            
            if (isNewOwner) {
                emailText += `We have automatically created a MatrixSpaces Owner account for you to manage your properties, assigned agents, and inquiries.\n\n`;
                emailText += `Direct Login URL: ${loginUrl}\n`;
                emailText += `Your Username/Email: ${targetOwnerEmail}\n`;
                emailText += `Your Temporary Password: ${tempPassword}\n\n`;
                emailText += `Please log in and update your password as soon as possible.\n`;
            } else {
                emailText += `You can manage your property directly from your Owner Dashboard:\n${loginUrl}\n`;
            }

            emailText += `\nBest regards,\nMatrixSpaces Team`;

            // Processes asynchronously to not block the Sales Agent's UI response
            transporter.sendMail({
                from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
                to: targetOwnerEmail,
                subject: isNewOwner ? 'Welcome to MatrixSpaces - Your Property is Live!' : `Your Property "${title}" is Live!`,
                text: emailText
            }).then(info => {
                const nodemailer = require('nodemailer');
                console.log("Owner notification email sent. Preview URL: %s", nodemailer.getTestMessageUrl(info));
            }).catch(e => console.error("Email send error:", e));
        }

        if (req.session.user.role === 'external_sales') {
            res.redirect('/sales?message=Property+Listed+Successfully');
        } else if (req.session.user.role === 'builder') {
            res.redirect('/builder?message=Property+Listed+Successfully');
        } else if (req.session.user.role === 'broker') {
            res.redirect('/broker?message=Property+Listed+Successfully');
        } else {
            res.redirect('/owner');
        }
    });

    router.post('/delete', validate(propertyDeleteSchema), (req, res, next) => {
        if (!req.session.user) return res.redirect('/login');
        next();
    }, async (req, res) => {
        const { id } = req.body;
        
        try {
            const result = await pool.query('SELECT owner_id, photos FROM properties WHERE id = $1', [id]);
            if (result.rows.length > 0) {
                const property = result.rows[0];
                const isOwner = isOwnerProfileRole(req.session.user.role) && property.owner_id === req.session.user.id;
                const isAdmin = req.session.user.role === 'admin';

                if (isOwner || isAdmin) {
                    if (property.photos && property.photos.length > 0) {
                    const { S3Client, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
                    const s3Options = { region: process.env.AWS_REGION };
                    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                        s3Options.credentials = {
                            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                        };
                    }
                    const s3 = new S3Client(s3Options);
                    const objectsToDelete = property.photos.map(photo => ({ Key: photo }));
                    
                    try {
                        await s3.send(new DeleteObjectsCommand({
                            Bucket: process.env.AWS_S3_BUCKET_NAME,
                            Delete: { Objects: objectsToDelete }
                        }));
                    } catch (err) {
                        console.error("Failed to delete S3 objects:", err);
                    }
                    }

                    await pool.query('DELETE FROM messages WHERE property_id = $1', [id]);
                    await pool.query('DELETE FROM visits WHERE property_id = $1', [id]);
                    await pool.query('DELETE FROM reviews WHERE property_id = $1', [id]);
                    await pool.query('DELETE FROM favorites WHERE property_id = $1', [id]);
                    await pool.query("DELETE FROM notifications WHERE link = '/property/' || $1", [id]);
                    await pool.query('DELETE FROM properties WHERE id = $1', [id]);
                }
            }
        } catch (err) { console.error("Delete error:", err); }
        
        if (req.session.user.role === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/owner');
        }
    });

    return router;
};
