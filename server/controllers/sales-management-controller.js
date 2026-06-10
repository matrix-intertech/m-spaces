const salesManagementService = require('../services/sales-management-service');

function redirectForRole(role, externalSalesPath = '/external-sales', brokerPath = '/broker?tab=salesManagement', builderPath = '/builder?tab=salesManagement') {
    if (role === 'builder') return builderPath;
    if (role === 'broker') return brokerPath;
    return externalSalesPath;
}

async function assignVisit(req, res) {
    if (!req.session.user || !['builder', 'broker'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    const visitId = req.body.visit_id || req.body.visitId;
    const agentId = req.body.agent_id || req.body.agentId || null;

    try {
        const result = await salesManagementService.assignVisit({
            user: req.session.user,
            req,
            visitId,
            agentId
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('Assign visit error:', err);
    }

    return res.redirect(req.get('Referer') || '/builder');
}

async function createAndAssignVisit(req, res) {
    if (!req.session.user || !['broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    const { property_id, user_id, agent_id, scheduled_at, notes } = req.body;

    try {
        const result = await salesManagementService.createAndAssignVisit({
            user: req.session.user,
            req,
            propertyId: property_id,
            userId: user_id,
            agentId: agent_id,
            scheduledAt: scheduled_at,
            notes
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('Error creating and assigning visit by agent:', err);
    }

    return res.redirect(redirectForRole(req.session.user.role));
}

async function assignPropertyToAgent(req, res) {
    if (!req.session.user || !['broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    const { property_id, agent_id } = req.body;

    try {
        const result = await salesManagementService.assignPropertyToAgent({
            user: req.session.user,
            req,
            propertyId: property_id,
            agentId: agent_id
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('Error assigning property by agent:', err);
    }

    return res.redirect(redirectForRole(req.session.user.role));
}

async function updateExternalSalesVisit(req, res) {
    if (!req.session.user || !['external_sales', 'broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    try {
        const result = await salesManagementService.updateVisitStatus({
            user: req.session.user,
            req,
            visitId: req.body.visitId,
            status: req.body.status,
            notes: req.body.notes
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('External sales update visit error:', err);
    }

    return res.redirect(redirectForRole(req.session.user.role, '/external-sales', '/broker?tab=myVisits', '/builder?tab=myVisits'));
}

async function addExternalSalesLead(req, res) {
    if (!req.session.user || !['external_sales', 'broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    try {
        const result = await salesManagementService.addLead({
            user: req.session.user,
            req,
            body: req.body
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('External sales add lead error:', err);
    }

    return res.redirect(redirectForRole(req.session.user.role));
}

async function respondToManagementRequest(req, res) {
    if (!req.session.user || req.session.user.role !== 'external_sales') {
        return res.status(403).send('Unauthorized');
    }

    const requestId = Number(req.body.request_id);
    const nextStatus = String(req.body.status || '').toLowerCase();
    if (!Number.isFinite(requestId) || !['accepted', 'rejected'].includes(nextStatus)) {
        return res.redirect('/sales?error=Invalid+management+request');
    }

    try {
        const result = await salesManagementService.respondToManagementRequest({
            user: req.session.user,
            requestId,
            status: nextStatus
        });

        if (!result.ok) {
            if (result.code === 'NOT_FOUND') {
                return res.redirect('/sales?error=Management+request+not+found');
            }
            return res.status(403).send(result.message);
        }
    } catch (err) {
        console.error('Management request response error:', err);
        return res.redirect('/sales?error=Failed+to+update+management+request');
    }

    return res.redirect('/sales?message=Management+request+updated');
}

async function reassignExternalSalesLead(req, res) {
    if (!req.session.user || !['broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    const { lead_id, new_agent_id } = req.body;
    if (!new_agent_id) return res.redirect(req.get('Referer') || '/');

    try {
        const result = await salesManagementService.reassignLead({
            user: req.session.user,
            req,
            leadId: lead_id,
            newAgentId: new_agent_id
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('Error reassigning lead:', err);
    }

    return res.redirect(req.get('Referer') || '/');
}

async function updateExternalSalesLeadStatus(req, res) {
    if (!req.session.user || !['external_sales', 'broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    const leadId = req.body.leadId || req.body.lead_id;
    try {
        const result = await salesManagementService.updateLeadStatus({
            user: req.session.user,
            req,
            leadId,
            status: req.body.status
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('Error updating lead status:', err);
    }

    return res.redirect(redirectForRole(req.session.user.role));
}

module.exports = {
    assignVisit,
    createAndAssignVisit,
    assignPropertyToAgent,
    updateExternalSalesVisit,
    addExternalSalesLead,
    respondToManagementRequest,
    reassignExternalSalesLead,
    updateExternalSalesLeadStatus
};
