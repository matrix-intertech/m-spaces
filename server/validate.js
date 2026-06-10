const validate = (schema, view, tab) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (e) {
        let errors = [];
        const issues = Array.isArray(e && e.errors) ? e.errors : (Array.isArray(e && e.issues) ? e.issues : []);
        if (issues.length) {
            errors = issues.map(err => ({
                field: err.path ? err.path.join('.') : 'unknown',
                message: err.message,
            }));
        } else {
            errors = [{ field: 'unknown', message: e ? e.message : 'Validation failed' }];
        }

        // For API routes that expect JSON
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.status(400).json({
                status: 'error',
                code: 'VALIDATION_ERROR',
                errors: errors
            });
        }

        // For standard HTML form submissions, re-render the page with an error
        const errorMessage = errors.map(err => err.message).join(', ');
        if (view) {
            return res.render(view, {
                user: req.session ? req.session.user : null,
                error: errorMessage,
                tab: tab || 'login',
                refCode: req.body.referral_code || ''
            });
        }

        res.status(400).send(`Validation Error: ${errorMessage}`);
    }
};

module.exports = validate;
