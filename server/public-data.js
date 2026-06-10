const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { fetchWithCache } = require('./redis-cache');

let envLoaded = false;
let pool = null;

function loadNativeRouteEnv() {
    if (envLoaded) return;
    envLoaded = true;

    const cwd = process.cwd();
    const candidates = [
        path.resolve(cwd, 'server/.env'),
        path.resolve(cwd, '.env'),
        path.join(__dirname, '.env'),
        path.join(__dirname, '../.env')
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            require('dotenv').config({ path: candidate });
        }
    }
}

function getDatabaseUrl() {
    loadNativeRouteEnv();
    return String(
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL ||
        process.env.POSTGRES_PRISMA_URL ||
        ''
    ).trim();
}

function getPool() {
    if (pool) return pool;

    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
        throw new Error('Missing DATABASE_URL for native public data routes.');
    }

    pool = new Pool({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
    });
    pool.postgisEnabled = false;
    return pool;
}

function getS3BaseUrl() {
    loadNativeRouteEnv();
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
    const pool = getPool();
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

    const queryParams = [];
    let selectClause = 'SELECT *';
    const fromClause = 'FROM properties';
    const whereClauses = ["status = 'listed'"];

    if (String(verifiedOnly) === 'true') {
        whereClauses.push('is_matrix_verified = TRUE');
    }

    if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
        queryParams.push(parseFloat(lat), parseFloat(lng));

        if (pool.postgisEnabled) {
            selectClause += ', (ST_DistanceSphere(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)) / 1000.0) AS distance';
        } else {
            selectClause += ', ( 6371 * acos( cos( radians($1) ) * cos( radians( latitude ) ) * cos( radians( longitude ) - radians($2) ) + sin( radians($1) ) * sin( radians( latitude ) ) ) ) AS distance';
        }
    }

    if (search && search.trim()) {
        const formattedSearch = search.replace(/[&|!():*]/g, '').trim().split(/\s+/).filter(Boolean).map((term) => `${term}:*`).join(' & ');
        if (formattedSearch) {
            queryParams.push(formattedSearch);
            whereClauses.push(`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(locality, '') || ' ' || coalesce(type, '') || ' ' || coalesce(condition, '')) @@ to_tsquery('simple', $${queryParams.length})`);
        }
    }

    if (minPrice && !isNaN(parseFloat(minPrice))) {
        queryParams.push(parseFloat(minPrice));
        whereClauses.push(`final_price >= $${queryParams.length}`);
    }
    if (maxPrice && !isNaN(parseFloat(maxPrice))) {
        queryParams.push(parseFloat(maxPrice));
        whereClauses.push(`final_price <= $${queryParams.length}`);
    }
    if (size) {
        queryParams.push(`%${size}%`);
        whereClauses.push(`size ILIKE $${queryParams.length}`);
    }
    if (condition) {
        queryParams.push(`%${condition}%`);
        whereClauses.push(`condition ILIKE $${queryParams.length}`);
    }
    if (locality) {
        queryParams.push(`%${locality}%`);
        whereClauses.push(`locality ILIKE $${queryParams.length}`);
    }
    if (type) {
        queryParams.push(type);
        whereClauses.push(`type = $${queryParams.length}`);
    }
    if (listingType) {
        queryParams.push(listingType);
        whereClauses.push(`listing_type = $${queryParams.length}`);
    }

    let query = `${selectClause} ${fromClause} WHERE ${whereClauses.join(' AND ')}`;
    const countQuery = `SELECT COUNT(*) AS total ${fromClause} WHERE ${whereClauses.join(' AND ')}`;
    const countQueryParams = [...queryParams];

    let sortClause = 'listed_at DESC';
    if (sortBy === 'price_asc') sortClause = 'final_price ASC';
    else if (sortBy === 'price_desc') sortClause = 'final_price DESC';
    else if (sortBy === 'newest') sortClause = 'listed_at DESC';
    else if (sortBy === 'oldest') sortClause = 'listed_at ASC';
    else if (lat && lng) sortClause = 'distance ASC';

    query += ` ORDER BY ${sortClause}`;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const offset = (pageNum - 1) * limitNum;

    queryParams.push(limitNum, offset);
    const paginatedQuery = query + ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;

    return { query: paginatedQuery, queryParams, countQuery, countQueryParams, limitNum, pageNum };
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

async function fetchProperties(reqQuery) {
    const pool = getPool();
    const limit = Math.min(100, Math.max(1, parseInt(Array.isArray(reqQuery.limit) ? reqQuery.limit[reqQuery.limit.length - 1] : reqQuery.limit, 10) || 12));
    const page = Math.max(1, parseInt(Array.isArray(reqQuery.page) ? reqQuery.page[reqQuery.page.length - 1] : reqQuery.page, 10) || 1);
    const queryInput = { ...reqQuery, limit, page };
    const { query, queryParams, countQuery, countQueryParams } = buildPropertyQuery(queryInput);
    const cacheKey = buildPropertySearchCacheKey('api_properties', queryInput);

    return fetchWithCache(cacheKey, 90, async () => {
        const [propertiesResult, countResult] = await Promise.all([
            pool.query(query, queryParams),
            pool.query(countQuery, countQueryParams)
        ]);
        const properties = propertiesResult.rows;
        const total = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(total / limit);
        return { properties, pagination: { total, page, totalPages, limit } };
    });
}

async function fetchPropertyById(id) {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM properties WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function fetchPartners() {
    const pool = getPool();
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

    return partnersRes.rows.map((partner) => ({
        ...partner,
        avatar_url: normalizePortfolioMediaUrl(partner.avatar_url),
        cover_url: normalizePortfolioMediaUrl(partner.cover_url),
        company_logo: normalizePortfolioMediaUrl(partner.company_logo)
    }));
}

module.exports = {
    buildPropertyQuery,
    buildPropertySearchCacheKey,
    fetchPartners,
    fetchProperties,
    fetchPropertyById,
    getS3BaseUrl,
    normalizePortfolioMediaUrl
};
