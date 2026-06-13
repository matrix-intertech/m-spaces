const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { fetchWithCache } = require('./redis-cache');

let envLoaded = false;
let pool = null;

const PUBLIC_PROPERTY_COLUMNS = [
    'id',
    'title',
    'type',
    'condition',
    'listing_type',
    'locality',
    'final_price',
    'size',
    'photos',
    'latitude',
    'longitude',
    'is_matrix_verified',
    'status',
    'listed_at',
    'created_at',
    'verification_status',
    'ownership_type'
];

function publicPropertySelect(prefix = '') {
    const qualifier = prefix ? `${prefix}.` : '';
    return [
        ...PUBLIC_PROPERTY_COLUMNS.map((column) => `${qualifier}${column}`),
        'NULL::text AS city',
        'NULL::text AS address',
        'NULL::numeric AS price',
        'NULL::numeric AS rent',
        'NULL::text AS photo',
        'NULL::text AS image_url',
        'NULL::text AS description',
        'NULL::text[] AS amenities',
        'NULL::text AS facing',
        'NULL::text AS configuration',
        'NULL::text AS floor_number',
        'NULL::text AS total_floors',
        'NULL::text AS overlooking',
        'NULL::text AS property_age',
        'NULL::timestamp AS updated_at',
        'NULL::text AS project_name',
        'NULL::text AS possession_status',
        'NULL::text AS video_url'
    ].join(', ');
}

function serializePublicProperty(property) {
    if (!property || typeof property !== 'object') return property;
    return {
        id: property.id,
        title: property.title,
        type: property.type,
        condition: property.condition,
        listing_type: property.listing_type,
        locality: property.locality,
        city: property.city ?? null,
        address: property.address ?? null,
        final_price: property.final_price,
        price: property.price ?? null,
        rent: property.rent ?? null,
        size: property.size,
        photos: property.photos,
        photo: property.photo ?? null,
        image_url: property.image_url ?? null,
        latitude: property.latitude,
        longitude: property.longitude,
        is_matrix_verified: property.is_matrix_verified,
        status: property.status,
        description: property.description ?? null,
        amenities: property.amenities ?? null,
        facing: property.facing ?? null,
        configuration: property.configuration ?? null,
        floor_number: property.floor_number ?? null,
        total_floors: property.total_floors ?? null,
        overlooking: property.overlooking ?? null,
        property_age: property.property_age ?? null,
        ownership_type: property.ownership_type ?? null,
        listed_at: property.listed_at,
        created_at: property.created_at,
        updated_at: property.updated_at ?? null,
        verification_status: property.verification_status,
        project_name: property.project_name ?? null,
        possession_status: property.possession_status ?? null,
        video_url: property.video_url ?? null,
        distance: property.distance
    };
}

function serializePublicPartner(partner) {
    if (!partner || typeof partner !== 'object') return partner;
    return {
        id: partner.id,
        name: partner.name,
        username: partner.username,
        role: partner.role,
        avatar_url: normalizePortfolioMediaUrl(partner.avatar_url),
        cover_url: normalizePortfolioMediaUrl(partner.cover_url),
        company_logo: normalizePortfolioMediaUrl(partner.company_logo),
        city: partner.city,
        locality: partner.locality,
        agency_name: partner.agency_name,
        about: partner.about,
        properties: Array.isArray(partner.properties)
            ? partner.properties.map(serializePublicProperty)
            : []
    };
}

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
    let selectClause = `SELECT ${publicPropertySelect()}`;
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
        const properties = propertiesResult.rows.map(serializePublicProperty);
        const total = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(total / limit);
        return { properties, pagination: { total, page, totalPages, limit } };
    });
}

async function fetchPropertyById(id) {
    const pool = getPool();
    const result = await pool.query(`SELECT ${publicPropertySelect()} FROM properties WHERE id = $1 AND status = 'listed'`, [id]);
    return result.rows[0] ? serializePublicProperty(result.rows[0]) : null;
}

async function fetchPartners() {
    const pool = getPool();
    const partnersRes = await pool.query(
        `SELECT
            u.id,
            u.name,
            u.username,
            u.role,
            u.avatar_url,
            u.cover_url,
            u.company_logo,
            u.city,
            u.locality,
            u.agency_name,
            u.about,
            COALESCE(
                json_agg(partner_properties.*) FILTER (WHERE partner_properties.id IS NOT NULL),
                '[]'::json
            ) AS properties
        FROM users u
        LEFT JOIN LATERAL (
            SELECT
                ${publicPropertySelect('p')}
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

    return partnersRes.rows.map(serializePublicPartner);
}

module.exports = {
    buildPropertyQuery,
    buildPropertySearchCacheKey,
    fetchPartners,
    fetchProperties,
    fetchPropertyById,
    getS3BaseUrl,
    normalizePortfolioMediaUrl,
    publicPropertySelect,
    serializePublicPartner,
    serializePublicProperty
};
