const adminReferralService = require('../services/admin-referral-service');

async function payReferral(req, res) {
    try {
        await adminReferralService.payReferral({ referralId: req.body.referral_id });
    } catch (error) {
        console.error('Referral payment error:', error);
    }

    return res.redirect('/admin?tab=referrals');
}

async function updateWithdrawalStatus(req, res) {
    try {
        await adminReferralService.updateWithdrawalStatus({
            withdrawalId: req.body.withdrawal_id,
            status: req.body.status
        });
    } catch (error) {
        console.error('Withdrawal status update error:', error);
    }

    return res.redirect('/admin?tab=referrals');
}

async function exportPendingWithdrawals(req, res) {
    try {
        const result = await adminReferralService.exportPendingWithdrawals();
        if (!result.ok) {
            return res.status(404).send(result.message);
        }

        res.header('Content-Type', result.contentType);
        res.attachment(result.filename);
        return res.send(result.body);
    } catch (error) {
        console.error('Error exporting withdrawals:', error);
        return res.status(500).send('Error exporting data.');
    }
}

module.exports = {
    payReferral,
    updateWithdrawalStatus,
    exportPendingWithdrawals
};
