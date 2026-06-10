const notificationService = require('../notification-service');
const repository = require('../repositories/admin-referral-repository');

async function payReferral({ referralId }) {
    const client = await repository.beginTransaction();
    try {
        const referral = await repository.getVerifiedReferral(referralId, client);
        if (referral) {
            await repository.markReferralPaid(referralId, client);
            await repository.creditUserWallet(referral.referrer_id, referral.amount, client);
        }
        await repository.commitTransaction(client);
        return { ok: true };
    } catch (error) {
        await repository.rollbackTransaction(client);
        throw error;
    } finally {
        repository.releaseTransaction(client);
    }
}

async function updateWithdrawalStatus({ withdrawalId, status }) {
    const client = await repository.beginTransaction();
    let withdrawal = null;
    try {
        withdrawal = await repository.getPendingWithdrawal(withdrawalId, client);
        if (withdrawal) {
            await repository.updateWithdrawalStatus(withdrawalId, status, client);
            if (status === 'rejected') {
                await repository.creditUserWallet(withdrawal.user_id, withdrawal.amount, client);
            }
        }
        await repository.commitTransaction(client);
    } catch (error) {
        await repository.rollbackTransaction(client);
        throw error;
    } finally {
        repository.releaseTransaction(client);
    }

    if (withdrawal) {
        if (status === 'rejected') {
            await notificationService.sendNotification(
                withdrawal.user_id,
                `Your withdrawal of INR ${withdrawal.amount} has been rejected. The amount has been returned to your wallet.`,
                '/wallet'
            );
        } else if (status === 'approved') {
            await notificationService.sendNotification(
                withdrawal.user_id,
                `Your withdrawal of INR ${withdrawal.amount} has been approved and is being processed.`,
                '/wallet'
            );
        }
    }

    return { ok: true };
}

async function exportPendingWithdrawals() {
    const rows = await repository.listPendingWithdrawals();
    if (!rows.length) {
        return { ok: false, code: 'NOT_FOUND', message: 'No pending withdrawals to export.' };
    }

    const fields = ['id', 'name', 'email', 'phone', 'amount', 'payment_details', 'created_at'];
    const csvRows = [fields.join(',')];
    for (const row of rows) {
        const values = fields.map((field) => {
            let value = row[field];
            if (value === null || value === undefined) value = '';
            return `"${String(value).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }

    return {
        ok: true,
        filename: 'pending-withdrawals.csv',
        contentType: 'text/csv',
        body: csvRows.join('\n')
    };
}

module.exports = {
    payReferral,
    updateWithdrawalStatus,
    exportPendingWithdrawals
};
