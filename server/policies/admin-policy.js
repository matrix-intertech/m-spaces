function isAdmin(user) {
    return String(user && user.role || '').toLowerCase() === 'admin';
}

function requireAdmin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).send('Authentication required.');
    }
    if (!isAdmin(req.session.user)) {
        return res.status(403).send('Forbidden: Admin access required.');
    }
    return next();
}

module.exports = {
    isAdmin,
    requireAdmin
};
