const pool = require('../db');

async function getVerifiedReferral(referralId, client = pool) {
    const result = await client.query(
        "SELECT referrer_id, amount, status FROM referrals WHERE id = $1 AND status = 'verified'",
        [referralId]
    );
    return result.rows[0] || null;
}

async function markReferralPaid(referralId, client = pool) {
    await client.query("UPDATE referrals SET status = 'paid' WHERE id = $1", [referralId]);
}

async function creditUserWallet(userId, amount, client = pool) {
    await client.query(
        "UPDATE users SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2",
        [amount, userId]
    );
}

async function getPendingWithdrawal(withdrawalId, client = pool) {
    const result = await client.query(
        "SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending'",
        [withdrawalId]
    );
    return result.rows[0] || null;
}

async function updateWithdrawalStatus(withdrawalId, status, client = pool) {
    await client.query('UPDATE withdrawals SET status = $1 WHERE id = $2', [status, withdrawalId]);
}

async function listPendingWithdrawals(client = pool) {
    const result = await client.query(`
        SELECT w.id, u.name, u.email, u.phone, w.amount, w.payment_details, w.created_at
        FROM withdrawals w
        JOIN users u ON w.user_id = u.id
        WHERE w.status = 'pending'
        ORDER BY w.created_at ASC
    `);
    return result.rows;
}

async function beginTransaction() {
    const client = await pool.connect();
    await client.query('BEGIN');
    return client;
}

async function commitTransaction(client) {
    await client.query('COMMIT');
}

async function rollbackTransaction(client) {
    await client.query('ROLLBACK');
}

function releaseTransaction(client) {
    client.release();
}

module.exports = {
    getVerifiedReferral,
    markReferralPaid,
    creditUserWallet,
    getPendingWithdrawal,
    updateWithdrawalStatus,
    listPendingWithdrawals,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    releaseTransaction
};
