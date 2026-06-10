const workManagementService = require('../services/work-management-service');

function getSalesManagementRedirect(role) {
    if (role === 'builder') return '/builder?tab=salesManagement';
    if (role === 'broker') return '/broker?tab=salesManagement';
    return '/external-sales?tab=schedule';
}

async function createManagerTask(req, res) {
    if (!req.session.user || !['broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    try {
        const result = await workManagementService.createManagerTask({
            user: req.session.user,
            body: req.body
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('Broker task creation error:', err);
    }

    return res.redirect(req.get('Referer') || '/broker?tab=salesManagement');
}

async function updateManagerTask(req, res) {
    if (!req.session.user || !['broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    try {
        const result = await workManagementService.updateManagerTask({
            user: req.session.user,
            body: req.body
        });
        if (!result.ok) {
            if (result.code === 'NOT_FOUND') {
                return res.redirect(req.get('Referer') || '/broker?tab=salesManagement&error=Task+not+found');
            }
            return res.status(403).send(result.message);
        }
    } catch (err) {
        console.error('Broker task update error:', err);
    }

    return res.redirect(req.get('Referer') || '/broker?tab=salesManagement');
}

async function updateExternalSalesTask(req, res) {
    if (!req.session.user || req.session.user.role !== 'external_sales') {
        return res.status(403).send('Unauthorized');
    }

    try {
        const result = await workManagementService.updateExternalSalesTask({
            user: req.session.user,
            body: req.body
        });
        if (!result.ok) {
            if (result.code === 'NOT_FOUND') {
                return res.redirect('/sales?error=Task+not+found');
            }
            return res.status(403).send(result.message);
        }
    } catch (err) {
        console.error('Sales task update error:', err);
        return res.redirect('/sales?error=Failed+to+update+task');
    }

    return res.redirect('/sales?message=Task+updated');
}

async function createManagerTransaction(req, res) {
    if (!req.session.user || !['broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    try {
        const result = await workManagementService.createManagerTransaction({
            user: req.session.user,
            body: req.body
        });
        if (!result.ok) return res.status(403).send(result.message);
    } catch (err) {
        console.error('Broker transaction add error:', err);
        return res.redirect(req.get('Referer') || '/broker?tab=salesManagement&error=Failed+to+add+transaction');
    }

    return res.redirect(req.get('Referer') || '/broker?tab=salesManagement&message=Transaction+added');
}

async function createExternalSalesTransaction(req, res) {
    if (!req.session.user || req.session.user.role !== 'external_sales') {
        return res.status(403).send('Unauthorized');
    }

    try {
        await workManagementService.createExternalSalesTransaction({
            user: req.session.user,
            body: req.body
        });
    } catch (err) {
        console.error('Sales transaction add error:', err);
        return res.redirect('/sales?error=Failed+to+add+transaction');
    }

    return res.redirect('/sales?message=Transaction+added');
}

async function addSchedule(req, res) {
    if (!req.session.user || !['external_sales', 'broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    try {
        await workManagementService.addSchedule({
            user: req.session.user,
            body: req.body
        });
    } catch (err) {
        console.error('Error adding schedule:', err);
    }

    return res.redirect(getSalesManagementRedirect(req.session.user.role));
}

async function updateSchedule(req, res) {
    if (!req.session.user || !['external_sales', 'broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    try {
        await workManagementService.updateSchedule({
            user: req.session.user,
            body: req.body
        });
    } catch (err) {
        console.error('Error updating schedule:', err);
    }

    return res.redirect(getSalesManagementRedirect(req.session.user.role));
}

async function deleteSchedule(req, res) {
    if (!req.session.user || !['external_sales', 'broker', 'builder'].includes(req.session.user.role)) {
        return res.status(403).send('Unauthorized');
    }

    try {
        await workManagementService.deleteSchedule({
            user: req.session.user,
            scheduleId: req.body.scheduleId
        });
    } catch (err) {
        console.error('Error deleting schedule:', err);
    }

    return res.redirect(getSalesManagementRedirect(req.session.user.role));
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
