const express = require('express');
const pool = require('./db');

module.exports = function() {
    const router = express.Router();

    // Middleware to check if user is eligible to refer
    const isEligibleReferrer = (req, res, next) => {
        if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized' });
        
        // Restrict referral generation down to staff and partners
        const allowed = ['admin', 'support', 'external_sales', 'broker', 'builder'];
        if (allowed.includes(req.session.user.role)) {
            return next();
        }
        res.status(403).json({ error: 'Forbidden: Your role cannot generate referral codes.' });
    };

    // Get referral dashboard stats and history for the logged-in user
    router.get('/api/referrals/dashboard', isEligibleReferrer, async (req, res) => {
        try {
            const userId = req.session.user.id;
            const referralCode = req.session.user.referral_code;

            // Aggregate referral tracking
            const statsRes = await pool.query(`
                SELECT 
                    COUNT(*) as total_referrals,
                    COUNT(*) FILTER (WHERE referral_type = 'partner') as partner_referrals,
                    COUNT(*) FILTER (WHERE referral_type = 'user') as user_referrals,
                    SUM(amount) FILTER (WHERE status = 'verified' OR status = 'paid') as total_earned
                FROM referrals
                WHERE referrer_id = $1
            `, [userId]);
            
            // Detailed historical logging
            const historyRes = await pool.query(`
                SELECT r.id, r.status, r.amount, r.referral_type, r.created_at, 
                       u.name as referred_name, u.role as referred_role
                FROM referrals r
                JOIN users u ON r.referred_user_id = u.id
                WHERE r.referrer_id = $1
                ORDER BY r.created_at DESC
                LIMIT 50
            `, [userId]);

            res.json({ success: true, referral_code: referralCode, stats: statsRes.rows[0], history: historyRes.rows });
        } catch (error) {
            console.error("Referral dashboard error:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    return router;
};