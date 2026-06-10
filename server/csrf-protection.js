const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function createToken() {
    return crypto.randomBytes(32).toString('hex');
}

function ensureCsrfToken(req, res) {
    if (!req.session) return null;
    if (!req.session.csrfToken) {
        req.session.csrfToken = createToken();
    }

    if (res && typeof res.cookie === 'function') {
        res.cookie(CSRF_COOKIE_NAME, req.session.csrfToken, {
            httpOnly: false,
            sameSite: 'lax',
            secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
            path: '/'
        });
    }

    return req.session.csrfToken;
}

function submittedToken(req) {
    return (
        req.get('x-csrf-token') ||
        req.get('x-xsrf-token') ||
        (req.body && (req.body._csrf || req.body.csrfToken)) ||
        (req.query && req.query._csrf) ||
        ''
    );
}

function validateCsrfToken(req) {
    if (!req.session) return false;
    const expected = req.session.csrfToken;
    const actual = submittedToken(req);
    if (!expected || !actual) return false;
    const expectedBuffer = Buffer.from(String(expected));
    const actualBuffer = Buffer.from(String(actual));
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function requireCsrf(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
        ensureCsrfToken(req, res);
        return next();
    }

    if (validateCsrfToken(req)) return next();

    const wantsJson = req.xhr || (req.headers.accept && req.headers.accept.includes('json'));
    if (wantsJson) return res.status(403).json({ error: 'Invalid CSRF token.' });
    return res.status(403).send('Invalid CSRF token.');
}

function csrfTokenRoute(req, res) {
    const token = ensureCsrfToken(req, res);
    return res.json({ csrfToken: token });
}

module.exports = {
    CSRF_COOKIE_NAME,
    ensureCsrfToken,
    validateCsrfToken,
    requireCsrf,
    csrfTokenRoute
};
