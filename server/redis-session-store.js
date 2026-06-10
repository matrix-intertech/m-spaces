const session = require('express-session');

class RedisSessionStore extends session.Store {
    constructor({ client, prefix = 'sess:', ttlSeconds = 60 * 60 * 24 * 30 } = {}) {
        super();
        this.client = client;
        this.prefix = prefix;
        this.ttlSeconds = ttlSeconds;
    }

    getKey(sid) {
        return `${this.prefix}${sid}`;
    }

    getTtl(sessionData) {
        const expiresAt = sessionData && sessionData.cookie && sessionData.cookie.expires
            ? new Date(sessionData.cookie.expires).getTime()
            : 0;
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
            return Math.max(60, Math.ceil((expiresAt - Date.now()) / 1000));
        }
        return this.ttlSeconds;
    }

    get(sid, callback) {
        this.client.get(this.getKey(sid))
            .then((raw) => {
                if (!raw) return callback(null, null);
                try {
                    return callback(null, JSON.parse(raw));
                } catch (error) {
                    return callback(error);
                }
            })
            .catch((error) => callback(error));
    }

    set(sid, sessionData, callback = () => {}) {
        const ttl = this.getTtl(sessionData);
        this.client.set(this.getKey(sid), JSON.stringify(sessionData), 'EX', ttl)
            .then(() => callback(null))
            .catch((error) => callback(error));
    }

    destroy(sid, callback = () => {}) {
        this.client.del(this.getKey(sid))
            .then(() => callback(null))
            .catch((error) => callback(error));
    }

    touch(sid, sessionData, callback = () => {}) {
        const ttl = this.getTtl(sessionData);
        this.client.expire(this.getKey(sid), ttl)
            .then(() => callback(null))
            .catch((error) => callback(error));
    }
}

module.exports = RedisSessionStore;
