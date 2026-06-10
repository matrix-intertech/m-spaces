const { emailQueue } = require('../email-queue');
const notificationService = require('../notification-service');
const repository = require('../repositories/work-management-repository');
const { normalizeTaskStatus, normalizeTransactionStatus, isManagedSalesAgent } = require('../sales-workflow-utils');

async function createManagerTask({ user, body }) {
    const assigneeId = Number(body.assigned_to) || user.id;
    if (!(await isManagedSalesAgent(user.id, assigneeId))) {
        return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };
    }

    await repository.createTask({
        title: body.title,
        description: body.description || null,
        createdBy: user.id,
        assignedTo: assigneeId,
        parentId: user.id,
        relatedPropertyId: body.related_property_id || null,
        relatedLeadId: body.related_lead_id || null,
        dueAt: body.due_at || null,
        notes: body.notes || null
    });

    if (assigneeId !== user.id) {
        await notificationService.sendNotification(assigneeId, `New task assigned: ${body.title}`, '/sales');
    }

    return { ok: true };
}

async function updateManagerTask({ user, body }) {
    const taskStatus = normalizeTaskStatus(body.status);
    const task = await repository.getTask(body.task_id);
    if (!task) {
        return { ok: false, code: 'NOT_FOUND', message: 'Task not found' };
    }

    const authorized = task.created_by === user.id
        || task.assigned_to === user.id
        || await isManagedSalesAgent(user.id, task.assigned_to);

    if (!authorized) {
        return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };
    }

    await repository.updateTask({
        taskId: body.task_id,
        status: taskStatus,
        notes: body.notes || null
    });

    return { ok: true };
}

async function updateExternalSalesTask({ user, body }) {
    const taskStatus = normalizeTaskStatus(body.status);
    const task = await repository.getAssignedTask(body.task_id, user.id);
    if (!task) {
        return { ok: false, code: 'NOT_FOUND', message: 'Task not found' };
    }

    await repository.updateTask({
        taskId: body.task_id,
        status: taskStatus,
        notes: body.notes || null
    });

    return { ok: true };
}

async function createManagerTransaction({ user, body }) {
    const targetAgentId = Number(body.agent_id) || user.id;
    if (!(await isManagedSalesAgent(user.id, targetAgentId))) {
        return { ok: false, code: 'FORBIDDEN', message: 'Unauthorized' };
    }

    await repository.createTransaction({
        agentId: targetAgentId,
        propertyId: body.property_id || null,
        counterpartyName: body.counterparty_name || null,
        amount: body.amount || null,
        stage: body.stage || 'initiated',
        status: normalizeTransactionStatus(body.status),
        notes: body.notes || null
    });

    return { ok: true };
}

async function createExternalSalesTransaction({ user, body }) {
    await repository.createTransaction({
        agentId: user.id,
        propertyId: body.property_id || null,
        counterpartyName: body.counterparty_name || null,
        amount: body.amount || null,
        stage: body.stage || 'initiated',
        status: normalizeTransactionStatus(body.status),
        notes: body.notes || null
    });

    return { ok: true };
}

async function queueScheduleVisitEmails({ lead, scheduledAt }) {
    if (!lead || !lead.property_id) return;

    const property = await repository.getPropertyVisitEmailContext(lead.property_id);
    if (!property) return;

    const visitDetails = {
        propertyTitle: property.property_title,
        scheduledAt,
        latitude: property.latitude || null,
        longitude: property.longitude || null
    };

    if (property.owner_email) {
        await emailQueue.add('visitEmail', { email: property.owner_email, role: 'owner', visitDetails });
    }
    if (lead.email) {
        await emailQueue.add('visitEmail', { email: lead.email, role: 'tenant', visitDetails });
    }
}

async function addSchedule({ user, body }) {
    await repository.createSchedule({
        agentId: user.id,
        title: body.title,
        description: body.description || null,
        scheduledAt: body.scheduled_at,
        type: body.type || 'other',
        referenceId: body.reference_id || null
    });

    if (body.type === 'visit' && body.reference_id) {
        const lead = await repository.getAccessibleLeadForSchedule({
            referenceId: body.reference_id,
            userId: user.id,
            role: user.role
        });
        if (lead) {
            await queueScheduleVisitEmails({ lead, scheduledAt: body.scheduled_at });
        }
    }

    return { ok: true };
}

async function updateSchedule({ user, body }) {
    const schedule = await repository.getScheduleReference(body.scheduleId, user.id);

    await repository.updateSchedule({
        scheduleId: body.scheduleId,
        agentId: user.id,
        title: body.title,
        description: body.description || null,
        scheduledAt: body.scheduled_at,
        status: body.status,
        type: body.type || 'other'
    });

    if (schedule && schedule.reference_id && body.type === 'visit') {
        const lead = await repository.getLeadById(schedule.reference_id);
        if (lead) {
            await queueScheduleVisitEmails({ lead, scheduledAt: body.scheduled_at });
        }
    }

    return { ok: true };
}

async function deleteSchedule({ user, scheduleId }) {
    await repository.deleteSchedule(scheduleId, user.id);
    return { ok: true };
}

module.exports = {
    createManagerTask,
    updateManagerTask,
    updateExternalSalesTask,
    createManagerTransaction,
    createExternalSalesTransaction,
    addSchedule,
    updateSchedule,
    deleteSchedule
};
