const express = require('express');
const pool = require('./db');
const { fetchWithCache } = require('./redis-cache');
const { success, error } = require('./responseHandler');
const { sanitizeUserForClient } = require('./profile-utils');

function getS3BaseUrl() {
    if (process.env.AWS_S3_BUCKET_NAME && process.env.AWS_REGION) {
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`;
    }
    return 'https://matrixspaces-uploads-590184011565-ap-south-1-an.s3.ap-south-1.amazonaws.com/';
}

function normalizePortfolioMediaUrl(value) {
    if (!value || typeof value !== 'string') return value;
    const clean = value.trim().replace(/\\/g, '/').replace(/^['"]|['"]$/g, '');
    if (!clean || clean.includes('undefined') || clean === 'null') return null;
    if (/^(https?:|data:|blob:)/i.test(clean)) return clean;

    const s3BaseUrl = getS3BaseUrl();
    if (clean.startsWith('/uploads/')) {
        const key = clean.replace(/^\/uploads\//, '');
        if (!key) return null;
        if (/(^properties\/|^projects\/|^profiles\/|^covers\/|^logos\/|^avatars\/)/.test(key)) {
            return `${s3BaseUrl}${key}`;
        }
        if (!key.includes('/')) return `${s3BaseUrl}properties/${key}`;
        return clean;
    }

    if (clean.startsWith('uploads/')) {
        const key = clean.replace(/^uploads\//, '');
        if (!key) return null;
        if (/(^properties\/|^projects\/|^profiles\/|^covers\/|^logos\/|^avatars\/)/.test(key)) {
            return `${s3BaseUrl}${key}`;
        }
        if (!key.includes('/')) return `${s3BaseUrl}properties/${key}`;
        return `/${clean}`;
    }

    if (/(^properties\/|^projects\/|^profiles\/|^covers\/|^logos\/|^avatars\/)/.test(clean)) {
        return `${s3BaseUrl}${clean}`;
    }

    if (clean.startsWith('/')) return clean;
    if (clean.startsWith('assets/')) return `/${clean}`;
    return `${s3BaseUrl}${clean}`;
}

function buildPropertyQuery(reqQuery) {
    // Extract standard strings to prevent 500 crashes if query parameters are accidentally duplicated into arrays
    const extractStr = (val) => Array.isArray(val) ? val[val.length - 1] : val;
    const lat = extractStr(reqQuery.lat);
    const lng = extractStr(reqQuery.lng);
    const minPrice = extractStr(reqQuery.minPrice);
    const maxPrice = extractStr(reqQuery.maxPrice);
    const size = extractStr(reqQuery.size);
    const condition = extractStr(reqQuery.condition);
    const type = extractStr(reqQuery.type);
    const listingType = extractStr(reqQuery.listingType);
    const sortBy = extractStr(reqQuery.sortBy);
    const locality = extractStr(reqQuery.locality);
    const search = extractStr(reqQuery.search);
    const verifiedOnly = extractStr(reqQuery.verifiedOnly);
    const page = extractStr(reqQuery.page);
    const limit = extractStr(reqQuery.limit);

    let queryParams = [];
        
    let selectClause = "SELECT *";
    let fromClause = "FROM properties";
    let whereClauses = ["status = 'listed'"];

    // Only filter by verified if the user specifically toggles it
    if (String(verifiedOnly) === 'true') {
        whereClauses.push("is_matrix_verified = TRUE");
    }

    // Distance Calculation if Coordinates are provided
    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
        queryParams.push(parseFloat(lat), parseFloat(lng));
        
        // Use PostGIS ST_DistanceSphere if available, otherwise fallback to Haversine math
        if (pool.postgisEnabled) {
            selectClause += `, (ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)) / 1000.0) AS distance`;
        } else {
            selectClause += `, ( 6371 * acos( cos( radians($1) ) * cos( radians( latitude ) ) * cos( radians( longitude ) - radians($2) ) + sin( radians($1) ) * sin( radians( latitude ) ) ) ) AS distance`;
        }
    }

    // Full Text Search
    if (search && search.trim()) {
        // Strip PostgreSQL operators before parsing to prevent 500 errors
        const formattedSearch = search.replace(/[&|!():*]/g, '').trim().split(/\s+/).filter(Boolean).map(term => `${term}:*`).join(' & ');
        if (formattedSearch) {
            queryParams.push(formattedSearch);
            whereClauses.push(`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(locality, '') || ' ' || coalesce(type, '') || ' ' || coalesce(condition, '')) @@ to_tsquery('simple', $${queryParams.length})`);
        }
    }

    // Standard Filters with strict numeric checks to prevent PostgreSQL crashes
    if (minPrice && !isNaN(parseFloat(minPrice))) { queryParams.push(parseFloat(minPrice)); whereClauses.push(`final_price >= $${queryParams.length}`); }
    if (maxPrice && !isNaN(parseFloat(maxPrice))) { queryParams.push(parseFloat(maxPrice)); whereClauses.push(`final_price <= $${queryParams.length}`); }
    if (size) { queryParams.push(`%${size}%`); whereClauses.push(`size ILIKE $${queryParams.length}`); }
    if (condition) { queryParams.push(`%${condition}%`); whereClauses.push(`condition ILIKE $${queryParams.length}`); }
    if (locality) { queryParams.push(`%${locality}%`); whereClauses.push(`locality ILIKE $${queryParams.length}`); }
    if (type) { queryParams.push(type); whereClauses.push(`type = $${queryParams.length}`); }
    if (listingType) { queryParams.push(listingType); whereClauses.push(`listing_type = $${queryParams.length}`); }

    // Assemble Base Query
    let query = `${selectClause} ${fromClause} WHERE ${whereClauses.join(' AND ')}`;
    const countQuery = `SELECT COUNT(*) AS total ${fromClause} WHERE ${whereClauses.join(' AND ')}`;
    const countQueryParams = [...queryParams];

    // Sorting
    let sortClause = "listed_at DESC";
    if (sortBy === 'price_asc') sortClause = "final_price ASC";
    else if (sortBy === 'price_desc') sortClause = "final_price DESC";
    else if (sortBy === 'newest') sortClause = "listed_at DESC";
    else if (sortBy === 'oldest') sortClause = "listed_at ASC";
    else if (lat && lng) sortClause = "distance ASC"; // Sort by closest if location provided

    query += ` ORDER BY ${sortClause}`;

    // Add pagination to the main query
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 12)); // Default to 12 items per page
    const offset = (pageNum - 1) * limitNum;

    queryParams.push(limitNum, offset);
    const paginatedQuery = query + ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    return { query: paginatedQuery, queryParams, countQuery, countQueryParams };
}

function buildPropertySearchCacheKey(prefix, reqQuery) {
    const entries = Object.keys(reqQuery || {})
        .sort()
        .map((key) => {
            const value = reqQuery[key];
            if (Array.isArray(value)) return `${key}=${value.join(',')}`;
            return `${key}=${value ?? ''}`;
        });
    return `${prefix}:${entries.join('|')}`;
}

module.exports = function() {
    const router = express.Router();

    router.get('/favicon.ico', (req, res) => res.status(204).send());
    router.get('/terms', (req, res) => res.render('terms'));
    router.get('/privacy', (req, res) => res.render('privacy'));

    // SEO & PWA Standard Routes
    router.get('/sitemap.xml', (req, res) => {
        res.header('Content-Type', 'application/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://matrixspaces.com/</loc></url>
    <url><loc>https://matrixspaces.com/commercial-real-estate-india</loc></url>
    <url><loc>https://matrixspaces.com/search</loc></url>
    <url><loc>https://matrixspaces.com/premium-properties</loc></url>
    <url><loc>https://matrixspaces.com/sale-properties</loc></url>
    <url><loc>https://matrixspaces.com/partners</loc></url>
</urlset>`);
    });

    router.get(['/manifest.json', '/manifest.webmanifest'], (req, res) => {
        res.json({
            name: "MatrixSpaces",
            short_name: "MatrixSpaces",
            start_url: "/",
            display: "standalone",
            background_color: "#ffffff",
            theme_color: "#D4AF37"
        });
    });

    // Basic Health Check for uptime monitors & load balancers
    router.get(['/health', '/api/health'], (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

    router.get('/agents', (req, res) => {
        res.redirect(301, '/partners');
    });

    router.get('/partners', async (req, res) => {
        try {
            const partnersRes = await pool.query(
                `SELECT
                    u.id,
                    u.name,
                    u.username,
                    u.role,
                    u.email,
                    u.phone,
                    u.avatar_url,
                    u.cover_url,
                    u.company_logo,
                    u.city,
                    u.locality,
                    COALESCE(
                        json_agg(partner_properties.*) FILTER (WHERE partner_properties.id IS NOT NULL),
                        '[]'::json
                    ) AS properties
                FROM users u
                LEFT JOIN LATERAL (
                    SELECT
                        p.id,
                        p.title,
                        p.type,
                        p.locality,
                        NULL::text AS city,
                        NULL::text AS address,
                        p.final_price,
                        NULL::numeric AS price,
                        NULL::numeric AS rent,
                        p.size,
                        p.photos,
                        NULL::text AS photo,
                        NULL::text AS image_url,
                        p.listing_type,
                        p.status,
                        p.is_matrix_verified
                    FROM properties p
                    WHERE p.status IN ('listed', 'verified')
                      AND (
                        p.owner_id = u.id
                        OR p.assigned_broker_id = u.id
                        OR u.id = ANY(COALESCE(p.assigned_brokers, '{}'::integer[]))
                      )
                    ORDER BY COALESCE(p.listed_at, p.created_at) DESC NULLS LAST, p.id DESC
                    LIMIT 5
                ) partner_properties ON TRUE
                WHERE u.role IN ('builder', 'broker', 'dealer', 'agent', 'external_sales')
                  AND u.is_active = TRUE
                GROUP BY u.id
                ORDER BY u.username`
            );
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.json({ partners: partnersRes.rows });
            }
            res.render('partners', { 
                partners: partnersRes.rows, 
                user: req.session.user || null 
            });
        } catch (err) {
            console.error("Error fetching partners:", err);
            res.status(500).send("Server Error");
        }
    });

    router.get('/', async (req, res) => {
        const { viewAll, ajax, lat, lng } = req.query;
        // Force standard limits on the homepage if pagination parameters aren't provided
        if (!req.query.limit) req.query.limit = (!viewAll && lat && lng) ? 10 : (!viewAll ? 6 : 24);
        
        let { query, queryParams } = buildPropertyQuery(req.query);
        

        // Only use the cache if the user is loading the default homepage without filters
        const isDefaultSearch = !lat && !lng && !req.query.minPrice && !req.query.maxPrice && !req.query.size && !req.query.condition && !req.query.type && !req.query.listingType && !req.query.sortBy && !req.query.locality && !req.query.verifiedOnly && !req.query.search && (!req.query.page || req.query.page == 1);

        let properties;
        if (isDefaultSearch) {
            properties = await fetchWithCache('public_properties', 300, async () => (await pool.query(query, queryParams)).rows);
        } else {
            properties = (await pool.query(query, queryParams)).rows;
        }

        const saleProperties = await fetchWithCache('public_sale_properties', 300, async () => (await pool.query("SELECT * FROM properties WHERE status = 'listed' AND listing_type = 'sale' ORDER BY listed_at DESC LIMIT 10")).rows);

        const newlyAddedProperties = await fetchWithCache('public_new_properties', 300, async () => (await pool.query("SELECT * FROM properties WHERE status = 'listed' AND is_matrix_verified = TRUE ORDER BY listed_at DESC LIMIT 10")).rows);

        let recommendedProperties = [];
        let recentlyViewedProperties = [];
        if (req.session.user) {
            try {
                const recentView = await pool.query(
                    'SELECT p.id, p.type, p.locality FROM recently_viewed rv JOIN properties p ON rv.property_id = p.id WHERE rv.user_id = $1 ORDER BY rv.viewed_at DESC LIMIT 1',
                    [req.session.user.id]
                );
                if (recentView.rows.length > 0) {
                    const { id, type, locality } = recentView.rows[0];
                    const recRes = await pool.query(
                        "SELECT * FROM properties WHERE status = 'listed' AND id != $1 AND (type = $2 OR locality = $3) ORDER BY RANDOM() LIMIT 10",
                        [id, type, locality]
                    );
                    recommendedProperties = recRes.rows;
                } else if (req.session.user.saved_filters) {
                    const filters = JSON.parse(req.session.user.saved_filters);
                    if (filters.type || filters.locality) {
                        let recQuery = "SELECT * FROM properties WHERE status = 'listed'";
                        let params = [];
                        if (filters.type) { params.push(filters.type); recQuery += ` AND type = $${params.length}`; }
                        if (filters.locality) { params.push(`%${filters.locality}%`); recQuery += ` AND locality ILIKE $${params.length}`; }
                        recQuery += " ORDER BY RANDOM() LIMIT 10";
                        const recRes2 = await pool.query(recQuery, params);
                        recommendedProperties = recRes2.rows;
                    }
                }
                const rvRes = await pool.query(
                    `SELECT p.* FROM properties p JOIN recently_viewed rv ON p.id = rv.property_id WHERE rv.user_id = $1 ORDER BY rv.viewed_at DESC LIMIT 10`,
                    [req.session.user.id]
                );
                recentlyViewedProperties = rvRes.rows;
            } catch (e) { console.error("Recommendation error:", e); }
        }

        let userFavorites = [];
        if (req.session.user) {
            const favRes = await pool.query('SELECT property_id FROM favorites WHERE user_id = $1', [req.session.user.id]);
            userFavorites = favRes.rows.map(r => r.property_id);
        }

        if (ajax || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            if (ajax) {
                return res.json({
                    properties,
                    userFavorites,
                    compareList: req.session.compareList || []
                });
            }
            return res.json({ 
                properties, 
                saleProperties, 
                newlyAddedProperties, 
                recommendedProperties, 
                recentlyViewedProperties, 
                userFavorites 
            });
        }
        res.render('index', { properties, saleProperties, newlyAddedProperties, recommendedProperties, recentlyViewedProperties, query: req.query, lat, lng, userFavorites });
    });

    // Search Results Page
    router.get('/search', async (req, res) => {
        try {
            const { ajax, lat, lng } = req.query;
            const limit = parseInt(req.query.limit) || 12;
            const page = parseInt(req.query.page) || 1;
            req.query.limit = limit;

            let { query, queryParams, countQuery, countQueryParams } = buildPropertyQuery(req.query);
            const cacheKey = buildPropertySearchCacheKey('search_results', req.query);
            const payload = await fetchWithCache(cacheKey, 90, async () => {
                const [propertiesResult, countResult] = await Promise.all([
                    pool.query(query, queryParams),
                    pool.query(countQuery, countQueryParams)
                ]);
                const properties = propertiesResult.rows;
                const total = parseInt(countResult.rows[0].total, 10);
                const totalPages = Math.ceil(total / limit);
                return { properties, pagination: { total, page, totalPages, limit } };
            });
            const properties = payload.properties;
            const pagination = payload.pagination;

            let userFavorites = [];
            if (req.session.user) {
                const favRes = await pool.query('SELECT property_id FROM favorites WHERE user_id = $1', [req.session.user.id]);
                userFavorites = favRes.rows.map(r => r.property_id);
            }

            if (ajax === 'true') {
                return res.json({ properties, pagination, userFavorites, compareList: req.session.compareList || [] });
            }

            // For any non-AJAX request, render the full search page.
            res.render('search', { properties, query: req.query, lat, lng, userFavorites, compareList: req.session.compareList || [], pagination });
        } catch (error) {
            console.error("Search error:", error);
            if (req.query.ajax === 'true') {
                return res.status(500).json({ error: 'Error loading results. Please try again.' });
            }
            res.status(500).send("An error occurred while searching.");
        }
    });

    // Public Requirements Board
    router.get('/requirements', async (req, res) => {
        try {
            const { search } = req.query;
            let query = `
                SELECT cr.id, cr.cities, cr.locality, cr.property_type, cr.requirement_type, cr.description, cr.min_size, cr.budget, cr.created_at, 
                       u.username as contact_name, u.email as contact_email, u.phone as contact_phone, u.agency_name
                FROM corporate_requirements cr
                JOIN users u ON cr.corporate_id = u.id
                WHERE cr.status = 'active'
            `;
            let params = [];
            
            if (search && search.trim()) {
                params.push(`%${search.trim()}%`);
                query += ` AND (cr.cities ILIKE $1 OR cr.locality ILIKE $1 OR cr.property_type ILIKE $1 OR cr.description ILIKE $1)`;
            }
            
            query += ` ORDER BY created_at DESC`;

            const reqsRes = await pool.query(query, params);
            let myRequirements = [];
            if (req.session && req.session.user) {
                const reqsRes2 = await pool.query("SELECT * FROM corporate_requirements WHERE corporate_id = $1 ORDER BY created_at DESC", [req.session.user.id]);
                myRequirements = reqsRes2.rows;
            }
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.json({ requirements: reqsRes.rows, query: req.query, myRequirements });
            }
            res.render('requirements', { requirements: reqsRes.rows, query: req.query, user: req.session.user || null, myRequirements });
        } catch (err) {
            console.error("Error fetching requirements:", err);
            res.status(500).send("Server Error");
        }
    });


    // API version of properties for the enhanced frontend
    router.get('/api/properties', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 12;
            const page = parseInt(req.query.page) || 1;
            req.query.limit = limit;

            const { query, queryParams, countQuery, countQueryParams } = buildPropertyQuery(req.query);
            const cacheKey = buildPropertySearchCacheKey('api_properties', req.query);
            const payload = await fetchWithCache(cacheKey, 90, async () => {
                const [propertiesResult, countResult] = await Promise.all([
                    pool.query(query, queryParams),
                    pool.query(countQuery, countQueryParams)
                ]);
                const properties = propertiesResult.rows;
                const total = parseInt(countResult.rows[0].total, 10);
                const totalPages = Math.ceil(total / limit);
                return { properties, pagination: { total, page, totalPages, limit } };
            });

            return res.json(payload);
        } catch (err) {
            console.error("API property fetch error:", err);
            return res.status(500).json({ error: 'Failed to fetch properties' });
        }
    });

    router.get('/api/properties/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query("SELECT * FROM properties WHERE id = $1", [id]);
            if (result.rows.length === 0) return error(res, 'Property not found', 'NOT_FOUND', 404);
            return success(res, result.rows[0]);
        } catch (err) {
            return error(res, 'Failed to fetch property details', 'DB_ERROR', 500);
        }
    });

    router.get('/api/user', (req, res) => {
        if (req.session.user) {
            return success(res, sanitizeUserForClient(req.session.user));
        } else {
            return success(res, null);
        }
    });

    router.get('/api/favorites', async (req, res) => {
        if (!req.session.user) return error(res, "Unauthorized", "UNAUTHORIZED", 401);
        try {
            const favRes = await pool.query('SELECT p.* FROM properties p JOIN favorites f ON p.id = f.property_id WHERE f.user_id = $1', [req.session.user.id]);
            return success(res, { favorites: favRes.rows });
        } catch (err) {
            return error(res, 'Failed to fetch favorites', 'DB_ERROR', 500);
        }
    });

    router.post('/api/favorites/:id', async (req, res) => {
        if (!req.session.user) return error(res, "Unauthorized", "UNAUTHORIZED", 401);
        const { id } = req.params;
        try {
            const check = await pool.query('SELECT 1 FROM favorites WHERE user_id = $1 AND property_id = $2', [req.session.user.id, id]);
            if (check.rows.length > 0) {
                await pool.query('DELETE FROM favorites WHERE user_id = $1 AND property_id = $2', [req.session.user.id, id]);
                return success(res, { action: 'removed' });
            } else {
                await pool.query('INSERT INTO favorites (user_id, property_id) VALUES ($1, $2)', [req.session.user.id, id]);
                return success(res, { action: 'added' });
            }
        } catch (err) {
            return error(res, err.message, "DB_ERROR", 500);
        }
    });

    router.get('/premium-properties', async (req, res) => {
        try {
            const { ajax, lat, lng } = req.query;
            const limit = parseInt(req.query.limit) || 12;
            const page = parseInt(req.query.page) || 1;
            req.query.limit = limit;

            const { query, queryParams, countQuery, countQueryParams } = buildPropertyQuery(req.query);

            // NOTE: Caching was removed here because the previous implementation was not
            // compatible with pagination and filtering, causing inconsistent results.
            const [propertiesResult, countResult] = await Promise.all([
                pool.query(query, queryParams),
                pool.query(countQuery, countQueryParams)
            ]);

            const properties = propertiesResult.rows;
            const total = parseInt(countResult.rows[0].total, 10);
            const totalPages = Math.ceil(total / limit);
            const pagination = { total, page, totalPages, limit };

            let userFavorites = [];
            if (req.session.user) {
                const favRes = await pool.query('SELECT property_id FROM favorites WHERE user_id = $1', [req.session.user.id]);
                userFavorites = favRes.rows.map(r => r.property_id);
            }

            if (ajax) return res.json({ properties, pagination, lat, lng, userFavorites, compareList: req.session.compareList || [] });
            res.render('premium-properties', { properties, query: req.query, lat, lng, userFavorites, pagination });
        } catch (err) {
            console.error("Premium properties error:", err);
            res.status(500).send("Server Error");
        }
    });

    router.get(['/sale-properties', '/newly-added'], async (req, res) => {
        try {
            const isNewlyAdded = req.path === '/newly-added';
            if (isNewlyAdded) { req.query.verifiedOnly = 'true'; } else { req.query.listingType = 'sale'; }

            const limit = parseInt(req.query.limit) || 24;
            const page = parseInt(req.query.page) || 1;
            req.query.limit = limit;

            const { query, queryParams, countQuery, countQueryParams } = buildPropertyQuery(req.query);
            const [propertiesResult, countResult] = await Promise.all([ pool.query(query, queryParams), pool.query(countQuery, countQueryParams) ]);
            const properties = propertiesResult.rows;
            const total = parseInt(countResult.rows[0].total, 10);
            const totalPages = Math.ceil(total / limit);
            const pagination = { total, page, totalPages, limit };
            
            let userFavorites = [];
            if (req.session.user) {
                const favRes = await pool.query('SELECT property_id FROM favorites WHERE user_id = $1', [req.session.user.id]);
                userFavorites = favRes.rows.map(r => r.property_id);
            }

            const template = isNewlyAdded ? 'newly-added' : 'sale-listings';
            res.render(template, { properties, userFavorites, query: req.query, pagination, pageTitle: isNewlyAdded ? "Newly Added Properties" : "Properties for Sale" });
        } catch (err) {
            console.error("Listing page error:", err);
            res.status(500).send("Server Error");
        }
    });

    router.get('/compare', async (req, res) => {
        const list = req.session.compareList || [];
        if (list.length === 0) {
            if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ properties: [] });
            return res.render('compare', { properties: [] });
        }
        const result = await pool.query('SELECT * FROM properties WHERE id = ANY($1::int[])', [list]);
        if (req.headers.accept && req.headers.accept.includes('application/json')) return res.json({ properties: result.rows });
        res.render('compare', { properties: result.rows });
    });

    router.get('/api/partner-follows', async (req, res) => {
        if (!req.session.user) return error(res, "Unauthorized", "UNAUTHORIZED", 401);
        try {
            const result = await pool.query(
                `SELECT partner_id FROM partner_follows WHERE follower_id = $1`,
                [req.session.user.id]
            );
            return success(res, { partnerIds: result.rows.map((row) => row.partner_id) });
        } catch (err) {
            return error(res, "Failed to fetch followed partners", "DB_ERROR", 500);
        }
    });

    router.post('/api/partner-follows/:partnerId', async (req, res) => {
        if (!req.session.user) return error(res, "Unauthorized", "UNAUTHORIZED", 401);
        const partnerId = Number(req.params.partnerId);
        if (!Number.isFinite(partnerId) || partnerId <= 0) {
            return error(res, "Invalid partner id", "VALIDATION_ERROR", 400);
        }
        if (partnerId === req.session.user.id) {
            return error(res, "You cannot follow yourself", "VALIDATION_ERROR", 400);
        }
        try {
            const partnerCheck = await pool.query(
                `SELECT id FROM users WHERE id = $1 AND role IN ('builder', 'broker', 'dealer', 'agent', 'external_sales') AND is_active = TRUE`,
                [partnerId]
            );
            if (partnerCheck.rows.length === 0) {
                return error(res, "Partner not found", "NOT_FOUND", 404);
            }
            const existing = await pool.query(
                `SELECT 1 FROM partner_follows WHERE follower_id = $1 AND partner_id = $2`,
                [req.session.user.id, partnerId]
            );
            if (existing.rows.length > 0) {
                await pool.query(
                    `DELETE FROM partner_follows WHERE follower_id = $1 AND partner_id = $2`,
                    [req.session.user.id, partnerId]
                );
                return success(res, { action: "unfollowed", partnerId });
            }
            await pool.query(
                `INSERT INTO partner_follows (follower_id, partner_id) VALUES ($1, $2)`,
                [req.session.user.id, partnerId]
            );
            return success(res, { action: "followed", partnerId });
        } catch (err) {
            return error(res, "Failed to update follow status", "DB_ERROR", 500);
        }
    });
    
    // Compare actions
    router.post('/compare/:action', (req, res) => {
        const isAjax = req.headers.accept && req.headers.accept.includes('application/json');
        if (!req.session.compareList) req.session.compareList = [];
        const { propertyId } = req.body;
        
        if (req.params.action === 'add') {
            if (req.session.compareList.length >= 4 && !req.session.compareList.includes(String(propertyId))) {
                return isAjax ? res.status(400).json({ error: 'You can only compare up to 4 properties.' }) : res.status(400).send('Limit reached');
            }
            if (!req.session.compareList.includes(String(propertyId))) req.session.compareList.push(String(propertyId));
        } else if (req.params.action === 'remove') {
            req.session.compareList = req.session.compareList.filter(id => id !== String(propertyId));
        }
        
        if (isAjax) return res.json({ success: true, count: req.session.compareList.length });
        res.redirect(req.get('Referer') || '/compare');
    });

    // Public API to fetch available brokers operating in a specific locality
    router.get('/api/local-brokers', async (req, res) => {
        try {
            const { locality } = req.query;
            if (!locality) return success(res, []);
            
            const brokers = await pool.query(
                "SELECT id, username, account_number, role, city, locality, avatar_url, (SELECT AVG(rating) FROM user_reviews WHERE target_user_id = users.id) as rating FROM users WHERE role IN ('broker', 'agent', 'external_sales') AND (role = 'external_sales' OR locality ILIKE $1) AND is_active = TRUE",
                [`%${locality}%`]
            );
            return success(res, brokers.rows);
        } catch (err) {
            return error(res, 'Failed to fetch local brokers', 'DB_ERROR', 500);
        }
    });

    router.get('/api/portfolio/:username', async (req, res) => {
        const username = req.params.username;
        try {
            const userRes = await pool.query(`
                SELECT
                    u.id, u.username, u.role, u.email, u.phone, u.avatar_url, u.cover_url, u.about,
                    u.facebook, u.linkedin, u.instagram, u.city, u.locality, u.agency_name,
                    u.google_business_link, u.company_website, u.rera_number,
                    parent.username AS parent_username,
                    parent.name AS parent_name,
                    parent.role AS parent_role,
                    parent.agency_name AS parent_agency_name
                FROM users u
                LEFT JOIN users parent ON parent.id = u.parent_id
                WHERE u.username = $1
            `, [username]);
            if (userRes.rows.length === 0) return error(res, 'Portfolio not found', 'NOT_FOUND', 404);

            const agent = {
                ...userRes.rows[0],
                avatar_url: normalizePortfolioMediaUrl(userRes.rows[0].avatar_url),
                cover_url: normalizePortfolioMediaUrl(userRes.rows[0].cover_url)
            };
            let properties = [];
            if (agent.role !== 'builder') {
                const propsRes = await pool.query("SELECT * FROM properties WHERE status IN ('listed', 'verified') AND (assigned_broker_id = $1 OR owner_id = $1) ORDER BY listed_at DESC", [agent.id]);
                properties = propsRes.rows;
            }

            let projects = [];
            let builderPortfolio = [];
            if (agent.role === 'builder') {
                const projRes = await pool.query("SELECT * FROM projects WHERE builder_id = $1 AND status != 'Unlisted' ORDER BY created_at DESC", [agent.id]);
                projects = projRes.rows;

                const bpRes = await pool.query("SELECT * FROM builder_portfolio WHERE builder_id = $1 ORDER BY completion_year DESC", [agent.id]);
                builderPortfolio = bpRes.rows;
            }

            return success(res, { agent, properties, projects, builderPortfolio });
        } catch (e) {
            console.error("API portfolio error:", e);
            return error(res, 'Failed to fetch portfolio', 'DB_ERROR', 500);
        }
    });

    // Redirect legacy portfolio links to the new root-level URL
    router.get('/portfolio/:username', (req, res) => {
        res.redirect(301, '/' + req.params.username);
    });

    // Public Portfolio / Showcase Page (Catch-all root URL)
    router.get('/:username', async (req, res, next) => {
        const username = req.params.username;
        
        // Block common top-level reserved routes from hitting the portfolio DB query
        const reservedPaths = ['api', 'admin', 'login', 'signup', 'dashboard', 'assets', 'css', 'js', 'images', 'uploads', 'fonts', 'portfolio'];
        if (username.includes('.') || reservedPaths.includes(username.toLowerCase())) {
            return next();
        }
        
        try {
            const userRes = await pool.query(`
                SELECT
                    u.id, u.username, u.role, u.email, u.phone, u.avatar_url, u.cover_url, u.about,
                    u.facebook, u.linkedin, u.instagram, u.city, u.locality, u.agency_name,
                    u.google_business_link, u.company_website, u.rera_number,
                    parent.username AS parent_username,
                    parent.name AS parent_name,
                    parent.role AS parent_role,
                    parent.agency_name AS parent_agency_name
                FROM users u
                LEFT JOIN users parent ON parent.id = u.parent_id
                WHERE u.username = $1
            `, [username]);
            if (userRes.rows.length === 0) return next(); // Pass to dashboard/404 if not found
            
            const agent = {
                ...userRes.rows[0],
                avatar_url: normalizePortfolioMediaUrl(userRes.rows[0].avatar_url),
                cover_url: normalizePortfolioMediaUrl(userRes.rows[0].cover_url)
            };
            // Fetch properties managed OR owned by this specific agent
            let properties = [];
            if (agent.role !== 'builder') {
                const propsRes = await pool.query("SELECT * FROM properties WHERE status IN ('listed', 'verified') AND (assigned_broker_id = $1 OR owner_id = $1) ORDER BY listed_at DESC", [agent.id]);
                properties = propsRes.rows;
            }
            
            let projects = [];
            let builderPortfolio = [];
            if (agent.role === 'builder') {
                const projRes = await pool.query("SELECT * FROM projects WHERE builder_id = $1 AND status != 'Unlisted' ORDER BY created_at DESC", [agent.id]);
                projects = projRes.rows;
                
                const bpRes = await pool.query("SELECT * FROM builder_portfolio WHERE builder_id = $1 ORDER BY completion_year DESC", [agent.id]);
                builderPortfolio = bpRes.rows;
            }

            let userFavorites = [];
            if (req.session && req.session.user) {
                const favRes = await pool.query('SELECT property_id FROM favorites WHERE user_id = $1', [req.session.user.id]);
                userFavorites = favRes.rows.map(r => r.property_id);
            }
            
            // Ensure rendering handles possible EJS errors if user relies on old variables
            res.render('portfolio', { agent, properties, projects, builderPortfolio, userFavorites, compareList: req.session?.compareList || [], user: req.session?.user || null });
        } catch(e) { 
            console.error("Error fetching portfolio:", e); 
            next(e); // Pass to standard 500 error handler
        }
    });

    return router;
};
