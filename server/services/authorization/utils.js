function normalizeId(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function roleOf(user) {
    return String(user && user.role || '').toLowerCase();
}

function wantsJson(req) {
    return Boolean(req && (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))));
}

module.exports = {
    normalizeId,
    roleOf,
    wantsJson
};
