const propertyPolicy = require('../../policies/property-policy');
const conversationPolicy = require('../../policies/conversation-policy');
const visitPolicy = require('../../policies/visit-policy');
const leadPolicy = require('../../policies/lead-policy');
const { wantsJson } = require('./utils');

const policies = {
    property: propertyPolicy,
    conversation: conversationPolicy,
    visit: visitPolicy,
    lead: leadPolicy
};

const actionMap = {
    view: 'canView',
    read: 'canView',
    create: 'canCreate',
    edit: 'canEdit',
    update: 'canEdit',
    delete: 'canDelete',
    assign: 'canAssign',
    manage: 'canManage',
    transfer: 'canTransfer',
    inquire: 'canInquire'
};

function getPolicy(resource) {
    return policies[String(resource || '').toLowerCase()] || null;
}

async function loadAuthorizationSubject(resource, subjectOrId, req) {
    const policy = getPolicy(resource);
    if (!policy) throw new Error(`Unknown authorization resource: ${resource}`);
    if (!subjectOrId || typeof subjectOrId === 'object') return subjectOrId || null;
    if (typeof policy.load !== 'function') return subjectOrId;
    return policy.load(subjectOrId, req);
}

async function authorize({ user, resource, action, subject, context = {}, req }) {
    const policy = getPolicy(resource);
    if (!policy) throw new Error(`Unknown authorization resource: ${resource}`);

    const methodName = actionMap[String(action || '').toLowerCase()] || action;
    const method = policy && policy[methodName];
    if (typeof method !== 'function') {
        throw new Error(`Unsupported authorization action "${action}" for resource "${resource}"`);
    }

    const resolvedSubject = await loadAuthorizationSubject(resource, subject, req);
    return Boolean(await method({ user, subject: resolvedSubject, context, req }));
}

function respondUnauthorized(req, res, options = {}) {
    if (wantsJson(req) || options.jsonOnly) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    return res.redirect(options.loginRedirect || '/login');
}

function respondForbidden(req, res, options = {}) {
    if (wantsJson(req) || options.jsonOnly) {
        return res.status(403).json({ error: options.forbiddenMessage || 'Forbidden.' });
    }
    return res.status(403).send(options.forbiddenMessage || 'Forbidden.');
}

function requireAuthorization(resource, action, resolveSubject, options = {}) {
    return async (req, res, next) => {
        if (!req.session || !req.session.user) {
            return respondUnauthorized(req, res, options);
        }

        const subjectValue = typeof resolveSubject === 'function' ? await resolveSubject(req) : resolveSubject;
        const subject = await loadAuthorizationSubject(resource, subjectValue, req);
        const allowed = await authorize({
            user: req.session.user,
            resource,
            action,
            subject,
            context: typeof options.resolveContext === 'function' ? await options.resolveContext(req) : (options.context || {}),
            req
        });

        if (!allowed) {
            return respondForbidden(req, res, options);
        }

        if (options.attachAs) {
            req[options.attachAs] = subject;
        } else {
            req.authorizedSubject = subject;
        }

        return next();
    };
}

module.exports = {
    authorize,
    loadAuthorizationSubject,
    requireAuthorization
};
