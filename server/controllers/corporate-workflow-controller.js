const corporateWorkflowService = require('../services/corporate-workflow-service');

function getS3BaseUrl() {
    return process.env.AWS_S3_BUCKET_NAME
        ? `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/`
        : 'https://matrixspaces-uploads-590184011565-ap-south-1-an.s3.ap-south-1.amazonaws.com/';
}

async function corporateDashboard(req, res) {
    if (!req.session.user || (req.session.user.role !== 'corporate' && req.session.user.role !== 'corporate_user')) {
        return res.redirect('/login');
    }

    const data = await corporateWorkflowService.getCorporateDashboardData(req.session.user);

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.json(data);
    }

    return res.render('corporate-dashboard', {
        ...data,
        tab: req.query.tab || 'overview'
    });
}

async function addSubordinate(req, res) {
    if (!req.session.user || req.session.user.role !== 'corporate' || !req.session.user.is_domain_approved) {
        return res.status(403).send('Unauthorized or domain not approved.');
    }

    const result = await corporateWorkflowService.addSubordinate(req.session.user, req.body);
    if (!result.ok) {
        if (result.code === 'PASSWORD') {
            return res.redirect('/corporate?error=' + encodeURIComponent(result.message));
        }
        if (result.code === 'DOMAIN') {
            return res.redirect('/corporate?error=Email+domain+mismatch');
        }
    }

    return res.redirect('/corporate');
}

async function addCorporateRequirement(req, res) {
    if (!req.session.user || !['corporate', 'corporate_user'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    await corporateWorkflowService.addRequirement(req.session.user, req.body);
    return res.redirect('/corporate?tab=requirements');
}

async function addSharedRequirement(req, res) {
    if (!req.session.user) return res.redirect('/login');

    await corporateWorkflowService.addSharedRequirement(req.session.user, req.body);

    const msg = 'Requirement posted successfully!';
    const referer = req.get('Referer') ? req.get('Referer').split('?')[0] : '/requirements';
    return res.redirect(`${referer}?message=${encodeURIComponent(msg)}`);
}

async function deleteUserRequirement(req, res) {
    if (!req.session.user) return res.redirect('/login');

    await corporateWorkflowService.deleteUserRequirement(req.session.user, req.body.req_id);
    return res.redirect(req.get('Referer') || '/requirements');
}

async function updateCorporateProfile(req, res) {
    if (!req.session.user || req.session.user.role !== 'corporate') {
        return res.status(403).send('Unauthorized');
    }

    const logoPath = req.file
        ? (req.file.location || (req.file.key ? getS3BaseUrl() + req.file.key : '/uploads/' + req.file.filename))
        : req.session.user.company_logo;

    const result = await corporateWorkflowService.updateProfile(req.session.user, req.body, logoPath);
    if (result.ok) {
        Object.assign(req.session.user, result.sessionUpdates);
    }

    return res.redirect('/corporate?tab=overview');
}

module.exports = {
    corporateDashboard,
    addSubordinate,
    addCorporateRequirement,
    addSharedRequirement,
    deleteUserRequirement,
    updateCorporateProfile
};
