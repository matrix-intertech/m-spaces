const notificationService = require('../notification-service');
const { authorize, loadAuthorizationSubject } = require('./authorization');
const { syncPropertyAssignmentsForProperty } = require('../property-assignment-service');
const repository = require('../repositories/sales-management-repository');
const { getSalesAgentContext } = require('../sales-agent-utils');

async function assignVisit({ user, req, visitId, agentId }) {
    const visit = await loadAuthorizationSubject('visit', visitId, req);
    const allowed = await authorize({
        user,
        resource: 'visit',
        action: 'assign',
        subject: visit,
        context: { agentId },
        req
    });
    if (!allowed) return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };

    await repository.updateVisitAssignment({
        visitId,
        agentId,
        status: agentId ? 'assigned' : 'pending'
    });

    return { ok: true };
}

async function createAndAssignVisit({ user, req, propertyId, userId, agentId, scheduledAt, notes }) {
    const targetAgentId = agentId || user.id;
    const allowed = await authorize({
        user,
        resource: 'property',
        action: 'assign',
        subject: propertyId,
        context: { agentId: targetAgentId },
        req
    });
    if (!allowed) {
        return { ok: false, code: 'FORBIDDEN', message: 'Cannot assign visit outside your property/team scope.' };
    }

    await repository.createAssignedVisit({
        propertyId,
        userId,
        agentId: targetAgentId,
        scheduledAt,
        notes
    });
    await notificationService.sendNotification(targetAgentId, `You have been assigned a new visit for property ${propertyId}.`, '/visits');
    return { ok: true };
}

async function assignPropertyToAgent({ user, req, propertyId, agentId }) {
    const targetAgentId = agentId || user.id;
    const allowed = await authorize({
        user,
        resource: 'property',
        action: 'assign',
        subject: propertyId,
        context: { agentId: targetAgentId },
        req
    });
    if (!allowed) {
        return { ok: false, code: 'FORBIDDEN', message: 'Cannot assign property outside your team scope.' };
    }

    await repository.appendPropertyAssignment({ propertyId, agentId: targetAgentId });
    await syncPropertyAssignmentsForProperty({ propertyId });
    await notificationService.sendNotification(targetAgentId, `A new property (${propertyId}) has been assigned to you for management.`, '/broker');
    return { ok: true };
}

async function updateVisitStatus({ user, req, visitId, status, notes }) {
    const visit = await loadAuthorizationSubject('visit', visitId, req);
    const allowed = await authorize({
        user,
        resource: 'visit',
        action: 'manage',
        subject: visit,
        req
    });
    if (!allowed) return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };

    await repository.updateVisitStatus({ visitId, status, notes });
    if (status === 'completed') {
        const visitUserId = await repository.getVisitUserId(visitId);
        if (visitUserId) {
            await repository.verifyPendingReferralForUser(visitUserId);
        }
    }
    return { ok: true };
}

async function addLead({ user, req, body }) {
    const canCreateLead = await authorize({
        user,
        resource: 'lead',
        action: 'create',
        subject: null,
        req
    });
    if (!canCreateLead) return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };

    if (body.property_id) {
        const canUseProperty = await authorize({
            user,
            resource: 'property',
            action: 'manage',
            subject: body.property_id,
            req
        });
        if (!canUseProperty) return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };
    }

    await repository.createLead({
        agentId: user.id,
        name: body.name,
        phone: body.phone,
        email: body.email,
        type: body.type,
        preferences: body.preferences,
        propertyId: body.property_id
    });

    return { ok: true };
}

async function respondToManagementRequest({ user, requestId, status }) {
    const salesContext = await getSalesAgentContext(user.id);
    if (salesContext.salesAgentType !== 'independent') {
        return { ok: false, code: 'FORBIDDEN', message: 'Only independent sales agents can respond to management requests.' };
    }

    const request = await repository.getPendingManagementRequest({ requestId, agentId: user.id });
    if (!request) return { ok: false, code: 'NOT_FOUND', message: 'Management request not found' };

    await repository.updateManagementRequestStatus({ requestId, status });

    if (status === 'accepted') {
        await repository.appendPropertyAssignment({ propertyId: request.property_id, agentId: user.id });
        await syncPropertyAssignmentsForProperty({ propertyId: request.property_id });
        await notificationService.sendNotification(request.owner_id, `Your property management request was accepted by ${user.username}.`, '/owner');
    } else {
        await notificationService.sendNotification(request.owner_id, `Your property management request was rejected by ${user.username}.`, '/owner');
    }

    return { ok: true };
}

async function reassignLead({ user, req, leadId, newAgentId }) {
    const lead = await loadAuthorizationSubject('lead', leadId, req);
    const allowed = await authorize({
        user,
        resource: 'lead',
        action: 'assign',
        subject: lead,
        context: { agentId: newAgentId },
        req
    });
    if (!allowed) return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };

    await repository.reassignLead({ leadId, agentId: newAgentId });
    return { ok: true };
}

async function updateLeadStatus({ user, req, leadId, status }) {
    const lead = await loadAuthorizationSubject('lead', leadId, req);
    const allowed = await authorize({
        user,
        resource: 'lead',
        action: 'manage',
        subject: lead,
        req
    });
    if (!allowed) return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };

    await repository.updateLeadStatus({ leadId, status });
    return { ok: true };
}

module.exports = {
    assignVisit,
    createAndAssignVisit,
    assignPropertyToAgent,
    updateVisitStatus,
    addLead,
    respondToManagementRequest,
    reassignLead,
    updateLeadStatus
};
