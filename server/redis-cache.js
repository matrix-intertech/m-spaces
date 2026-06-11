let redisClient = null;
const localCache = new Map();

const hasRedis = !!(process.env.REDIS_URL || process.env.REDIS_HOST);

if (hasRedis) {
    const Redis = require('ioredis');
    redisClient = process.env.REDIS_URL
        ? new Redis(process.env.REDIS_URL)
        : new Redis({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT || 6379 });

    redisClient.on('error', (err) => {
        if (err.code !== 'ECONNREFUSED') {
            console.warn('Redis Cache warning:', err.message);
        }
    });
} else {
    if (process.env.NODE_ENV !== 'production') {
        console.warn('[Cache] No Redis configuration found. Using in-memory cache fallback.');
    }
    redisClient = { quit: () => {} }; // Mock quit to prevent crashes during shutdown
}

/**
 * Fetch data from Redis/Local cache or fallback to database query.
 * @param {string} key - The unique cache key.
 * @param {number} ttlSeconds - Time-to-live in seconds.
 * @param {Function} fetchCallback - Async function that returns the DB data.
 */
const fetchWithCache = async (key, ttlSeconds, fetchCallback) => {
    // Try fetching from Cache
    if (hasRedis && redisClient.status === 'ready') {
        try {
            const cached = await redisClient.get(key);
            if (cached) return JSON.parse(cached);
        } catch (err) {
            console.error('[Cache] Redis Get Error:', err.message);
        }
    } else if (!hasRedis) {
        const now = Date.now();
        const cached = localCache.get(key);
        if (cached && cached.expiry > now) {
            return cached.data;
        }
    }

    // Cache Miss - execute the database query
    const data = await fetchCallback();

    // Save to Cache
    if (data) {
        if (hasRedis && redisClient.status === 'ready') {
            try {
                await redisClient.setex(key, ttlSeconds, JSON.stringify(data));
            } catch (err) {
                console.error('[Cache] Redis Set Error:', err.message);
            }
        } else if (!hasRedis) {
            localCache.set(key, {
                data,
                expiry: Date.now() + (ttlSeconds * 1000)
            });
        }
    }

    return data;
};

const invalidateCache = async (key) => {
    if (hasRedis && redisClient.status === 'ready') {
        try {
            await redisClient.del(key);
        } catch (err) {
            console.error('[Cache] Redis Del Error:', err.message);
        }
    } else {
        localCache.delete(key);
    }
};

module.exports = {
    redisClient,
    fetchWithCache,
    invalidateCache,
    hasRedisConfig: hasRedis
};
