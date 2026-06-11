const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const pool = require('./db');
const { sendOtpEmail } = require('./emailService');
const { validatePassword, isPasswordReused, addToPasswordHistory, generateUniqueUsername, isRandomName } = require('./utils');
const nodemailer = require('nodemailer');
const validate = require('./validate'); // We just created this file
const { sendWhatsappOtpSchema, loginSchema, signupSchema, builderSignupSchema } = require('./auth.schema');
const { verifyTurnstile } = require('./captcha');
const { normalizeStandardProfileUser } = require('./profile-utils');

function getConfiguredAppOrigin(req) {
    const candidates = [
        process.env.PUBLIC_APP_ORIGIN,
        process.env.FRONTEND_ORIGIN,
        process.env.NEXT_PUBLIC_FRONTEND_URL,
        process.env.AUTH0_BASE_URL
    ].map((value) => String(value || '').trim()).filter(Boolean);

    for (const candidate of candidates) {
        try {
            return new URL(candidate).origin;
        } catch (_) {}
    }

    return `${req.protocol}://${req.get('host')}`;
}

function buildPublicUrl(req, pathname) {
    return new URL(pathname, `${getConfiguredAppOrigin(req)}/`).toString();
}

module.exports = function(uploadKyc, transporter, authLimiter, otpLimiter, whatsappOtpLimiter) {
    const router = express.Router();

    /**
     * Generates a unique account number for a new user.
     * @param {boolean} isAdmin - Whether the user is an admin.
     * @returns {Promise<string>} A unique account number.
     */
    async function generateUniqueAccountNumber(isAdmin = false) {
        let nextAccountNumber;
        // The database's UNIQUE constraint on account_number will prevent race conditions.
        // If two users sign up simultaneously, one will fail, which is an acceptable outcome.
        if (isAdmin) {
            // Find the highest existing admin account number, starting from 1001.
            const res = await pool.query("SELECT MAX(CAST(account_number AS INTEGER)) as max_acc FROM users WHERE role = 'admin' AND account_number ~ '^[0-9]{4}$'");
            const maxAdminNum = res.rows[0].max_acc || 1000; // Default to 1000 so the first is 1001
            nextAccountNumber = (maxAdminNum + 1).toString().padStart(4, '0');
        } else {
            // Find the highest existing regular user account number, starting from 1000001.
            const res = await pool.query("SELECT MAX(CAST(account_number AS INTEGER)) as max_acc FROM users WHERE role != 'admin' AND account_number ~ '^[0-9]{7}$'");
            const maxUserNum = res.rows[0].max_acc || 1000000; // Default to 1,000,000 so the first is 1,000,001
            nextAccountNumber = (maxUserNum + 1).toString();
        }
        return nextAccountNumber;
    }

    function formatAccountType(role) {
        const labels = {
            tenant: 'Tenant / User',
            owner: 'Property Owner',
            builder: 'Builder / Developer',
            broker: 'Broker',
            external_sales: 'Sales Agent',
            corporate: 'Corporate',
            corporate_user: 'Corporate User',
            admin: 'Admin',
            support: 'Support'
        };
        return labels[role] || String(role || 'Account').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    }

    function buildAccountTypeOptions(users) {
        const optionsByRole = new Map();
        for (const user of users) {
            if (!user.role) continue;
            const existing = optionsByRole.get(user.role) || {
                role: user.role,
                label: formatAccountType(user.role),
                count: 0
            };
            existing.count += 1;
            optionsByRole.set(user.role, existing);
        }
        return Array.from(optionsByRole.values());
    }

    function loginRedirectPath(user) {
        const role = String(user && user.role || '').toLowerCase();
        if (role === 'admin' || role === 'support') return '/admin?tab=overview';
        if (role === 'owner') return '/owner';
        if (role === 'builder') return '/builder';
        if (role === 'broker' || role === 'dealer' || role === 'agent') return '/broker';
        if (role === 'external_sales') return '/sales';
        if (role === 'corporate' || role === 'corporate_user') return '/corporate';
        return '/';
    }

    function saveSessionAndRespond(req, res, onSuccess) {
        req.session.save((error) => {
            if (error) {
                console.error('Session save error:', error);
                return res.status(500).json({ error: 'Failed to persist login session.' });
            }
            return onSuccess();
        });
    }

    function wantsJson(req) {
        return Boolean(req.headers.accept && req.headers.accept.includes('application/json'));
    }

    /**
     * Checks if a referred user has met all conditions and completes the referral if so.
     * @param {number} userId - The ID of the referred user.
     * @param {object} dbClient - The database client to use (for transactions).
     */
    async function checkAndCompleteReferral(userId, dbClient = pool) {
        const client = dbClient;
        // 1. Check if this user was referred and the referral is 'pending'
        const referralRes = await client.query(
            'SELECT id, referrer_id, amount FROM referrals WHERE referred_user_id = $1 AND status = $2',
            [userId, 'pending']
        );

        if (referralRes.rows.length > 0) {
            const referral = referralRes.rows[0];
            // 2. Get the referred user's details (assuming is_phone_verified column exists)
            const userRes = await client.query('SELECT name, is_phone_verified, role FROM users WHERE id = $1', [userId]);
            const referredUser = userRes.rows[0];

            // 3. Check if all conditions are met (name is not null/empty and phone is verified)
            if (referredUser && referredUser.name && referredUser.is_phone_verified) {
                // Partners require manual 'verified' status before completion, users complete automatically
                const newStatus = ['broker', 'builder', 'external_sales'].includes(referredUser.role) ? 'verified' : 'completed';
                
                const transactionClient = (dbClient === pool) ? await pool.connect() : dbClient;
                try {
                    if (dbClient === pool) await transactionClient.query('BEGIN');

                    // 4. Update referral status
                    await transactionClient.query('UPDATE referrals SET status = $1 WHERE id = $2', [newStatus, referral.id]);

                    // 5. Issue reward to the referrer if completed
                    if (newStatus === 'completed') {
                        const rewardAmount = referral.amount || 50;
                        await transactionClient.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [rewardAmount, referral.referrer_id]);
                        console.log(`Referral ${referral.id} completed. User ${referral.referrer_id} rewarded ${rewardAmount}.`);
                    } else {
                        console.log(`Referral ${referral.id} verified. Waiting for admin approval for payout.`);
                    }

                    if (dbClient === pool) await transactionClient.query('COMMIT');
                } catch (e) {
                    if (dbClient === pool) await transactionClient.query('ROLLBACK');
                    console.error('Error completing referral:', e);
                    if (dbClient !== pool) throw e; // Re-throw if in an existing transaction
                } finally {
                    if (dbClient === pool) transactionClient.release();
                }
            }
        }
    }

    /**
     * Processes a referral mapping if conditions are met.
     */
    async function processReferral(referral_code, newUserId, newUserRole, dbClient = pool) {
        if (!referral_code) return;
        try {
            const refRes = await dbClient.query('SELECT id, role FROM users WHERE referral_code = $1', [referral_code]);
            if (refRes.rows.length > 0) {
                const referrer = refRes.rows[0];
                const allowedReferrers = ['admin', 'support', 'external_sales', 'broker', 'builder'];
                if (allowedReferrers.includes(referrer.role)) {
                    if (referrer.id === newUserId) return; // Prevent self-referral
                    
                    const referralType = ['broker', 'builder', 'external_sales'].includes(newUserRole) ? 'partner' : 'user';
                    const rewardAmount = referralType === 'partner' ? 500 : 50; // Higher reward for partners
                    await dbClient.query('INSERT INTO referrals (referrer_id, referred_user_id, status, amount, referral_type, referral_role) VALUES ($1, $2, $3, $4, $5, $6)', [referrer.id, newUserId, 'pending', rewardAmount, referralType, newUserRole]);
                    await dbClient.query('UPDATE users SET referred_by = $1 WHERE id = $2', [referral_code, newUserId]);
                }
            }
        } catch (e) { console.error("Referral process error:", e); }
    }

    // OTP Routes
    router.post('/send-otp', otpLimiter, async (req, res) => {
        const email = req.body.email || req.body.username; // Fallback if frontend still sends 'username'
        if (!email) return res.status(400).json({ error: 'Email or Account Number is required' });

        let targetEmail = email;
        if (!email.includes('@')) {
            const userRes = await pool.query('SELECT email FROM users WHERE account_number = $1', [email]);
            if (userRes.rows.length === 0) {
                // New registrations are WhatsApp only
                return res.status(400).json({ error: 'New registrations are currently available only through WhatsApp verification.' });
            }

            if (userRes.rows.length > 0) {
                targetEmail = userRes.rows[0].email;
            } else {
                return res.status(400).json({ error: 'Account number not found.' });
            }
        }

        let otp;
        // Reuse OTP if requested again within the validity period
        if (req.session.otp && req.session.otp.email === targetEmail && req.session.otp.expires > Date.now()) {
            otp = req.session.otp.code; // Reuse existing OTP
        } else {
            const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [targetEmail]);
            if (userExists.rows.length === 0) {
                return res.status(400).json({ error: 'New registrations are currently available only through WhatsApp verification.' });
            }

            // Generate 6-digit OTP
            otp = crypto.randomInt(100000, 999999).toString();
            req.session.otp = {
                code: otp,
                email: targetEmail,
                originalInput: email,
                expires: Date.now() + 10 * 60 * 1000 // 10 minutes
            };
        }

        try {
            await sendOtpEmail(targetEmail, otp);
            req.session.save((err) => {
                if (err) console.error("Session save error:", err);
                res.json({ message: 'OTP sent successfully' });
            });
        } catch (err) {
            console.error("OTP Email Error:", err);
            res.status(500).json({ error: 'Failed to send OTP' });
        }
    });

    router.post('/verify-otp', otpLimiter, (req, res) => {
        const email = req.body.email || req.body.username;
        const { otp } = req.body;
        const sessionOtp = req.session.otp;

        if (!sessionOtp || (sessionOtp.email !== email && sessionOtp.originalInput !== email)) {
            return res.status(400).json({ error: 'No OTP request found for this email' });
        }
        if (Date.now() > sessionOtp.expires) {
            return res.status(400).json({ error: 'OTP has expired' });
        }
        if (String(sessionOtp.code) !== String(otp)) {
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        delete req.session.otp;
        res.json({ message: 'Verification successful' });
    });

    // OTP Login endpoint
    router.post('/login/otp', authLimiter, async (req, res) => {
        const email = req.body.email || req.body.username;
        const { otp, referral_code } = req.body;
        const sessionOtp = req.session.otp;

        if (!sessionOtp || (sessionOtp.email !== email && sessionOtp.originalInput !== email)) {
            return res.status(400).json({ error: 'No OTP request found for this input. Please request a new OTP.' });
        }
        if (Date.now() > sessionOtp.expires) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }
        if (String(sessionOtp.code) !== String(otp)) {
            return res.status(400).json({ error: 'Invalid OTP.' });
        }

        try {
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [sessionOtp.email]);
            let user;

            if (result.rows.length === 0) {
                // Auto-Signup!
                const randomPass = crypto.randomBytes(16).toString('hex');
                const hash = await bcrypt.hash(randomPass, 10);
                const account_number = await generateUniqueAccountNumber(false);
                const my_referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();

                // New registrations are WhatsApp only, so this path should not be hit for new users.
                // This block is for existing users who might not have a name/username set.
                const newUserResult = await pool.query(
                    'INSERT INTO users (name, username, account_number, email, password_hash, role, is_email_verified, referral_code, referred_by, has_random_password, is_phone_verified, profile_completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, FALSE, FALSE) RETURNING *',
                    [account_number, account_number, sessionOtp.email, hash, 'owner', true, my_referral_code, referral_code || null] // Default name/username to account_number for now
                );
                user = newUserResult.rows[0];
                await addToPasswordHistory(user.id, hash);
                await processReferral(referral_code, user.id, 'owner');
            } else {
                user = result.rows[0];
                if (user.is_active === false) {
                    return res.status(403).json({ error: 'Your account has been disabled. Please contact support.' });
                }
                if (!user.is_email_verified) {
                    await pool.query('UPDATE users SET is_email_verified = TRUE WHERE id = $1', [user.id]);
                    user.is_email_verified = true;
                }
                // Auto-generate referral code for legacy accounts
                if (!user.referral_code) {
                    user.referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
                    await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [user.referral_code, user.id]);
                }
            }

            delete req.session.otp; // Clear the OTP to prevent reuse
            req.session.user = normalizeStandardProfileUser(user);
            req.session.cookie.maxAge = 60 * 60 * 1000; // 1 hour timeout

            const redirectUrl = loginRedirectPath(user);
            return saveSessionAndRespond(req, res, () => res.json({ success: true, redirect: redirectUrl }));
        } catch (err) {
            console.error("OTP Login Error:", err);
            return res.status(500).json({ error: 'Server error during login.' });
        }
    });
    // WhatsApp OTP Routes (via MSG91)
    router.post('/send-whatsapp-otp', whatsappOtpLimiter, validate(sendWhatsappOtpSchema), async (req, res) => {
        const { phone } = req.body;
        const now = Date.now();

        let otp;
        let requestCount = 1;

        // Handle existing OTP session for cooldowns and reuse
        if (req.session.whatsappOtp && req.session.whatsappOtp.phone === phone) {
            const lastReq = req.session.whatsappOtp.lastRequestedAt || 0;
            requestCount = req.session.whatsappOtp.requestCount || 1;
            
            // Cooldown: 30s for the first resend, 60s for subsequent resends
            const waitTime = requestCount === 1 ? 30 * 1000 : 60 * 1000;
            
            if (now - lastReq < waitTime) {
                const remaining = Math.ceil((waitTime - (now - lastReq)) / 1000);
                return res.status(429).json({ error: `Please wait ${remaining} seconds before requesting another OTP.` });
            }

            if (req.session.whatsappOtp.expires > now) {
                otp = req.session.whatsappOtp.code;
            } else {
                otp = crypto.randomInt(100000, 999999).toString();
            }
            requestCount += 1;
        } else {
            otp = crypto.randomInt(100000, 999999).toString();
        }

        req.session.whatsappOtp = {
            code: otp,
            phone: phone,
            expires: (req.session.whatsappOtp && req.session.whatsappOtp.expires > now) ? req.session.whatsappOtp.expires : now + 10 * 60 * 1000,
            lastRequestedAt: now,
            requestCount: requestCount
        };

        try {
            const waService = require('./whatsappService');
            await waService.sendOtpVerification(phone, otp);

            req.session.save((err) => {
                if (err) console.error("Session save error:", err);
                res.json({ message: 'WhatsApp OTP sent successfully' });
            });
        } catch (err) {
            console.error("WhatsApp OTP Error:", err);
            const status = err.code === 'WA_PROVIDER_ERROR' || err.code === 'WA_NOT_CONFIGURED' || err.code === 'WA_NUMBER_MISSING'
                ? 503
                : 500;
            res.status(status).json({ error: err.userMessage || 'Failed to send WhatsApp OTP' });
        }
    });

    router.post('/login/whatsapp-otp', authLimiter, async (req, res) => {
        const { phone, otp, referral_code, role, name, agency_name, gst_number, rera_number } = req.body;
        const sessionOtp = req.session.whatsappOtp;

        if (!sessionOtp || sessionOtp.phone !== phone) {
            return res.status(400).json({ error: 'No OTP request found for this phone number. Please request a new OTP.' });
        }
        if (Date.now() > sessionOtp.expires) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }
        if (String(sessionOtp.code) !== String(otp)) {
            return res.status(400).json({ error: 'Invalid OTP.' });
        }

        try {
            // Ensure robust lookup handles both standard 10 digit or international inputs seamlessly
            const phoneDigits = String(phone || '').replace(/\D/g, '');
            const phoneLookupValues = Array.from(new Set([phone, phoneDigits.slice(-10)].filter(Boolean)));
            const result = await pool.query(
                'SELECT * FROM users WHERE phone = ANY($1::text[]) ORDER BY created_at DESC NULLS LAST, id DESC',
                [phoneLookupValues]
            );
            let user;
            let createdNewUser = false;
            let shouldShowLinkedAccounts = result.rows.length > 1;

            const createWhatsAppUser = async () => {
                const randomPass = crypto.randomBytes(16).toString('hex');
                const hash = await bcrypt.hash(randomPass, 10);
                const account_number = await generateUniqueAccountNumber(false);
                const my_referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
                
                const finalRole = role && ['tenant', 'owner', 'builder', 'broker', 'external_sales', 'corporate'].includes(role)
                    ? role
                    : 'owner';
                const finalName = typeof name === 'string' && name.trim() !== '' ? name.trim() : null;
                const finalAgencyName = typeof agency_name === 'string' && agency_name.trim() !== '' ? agency_name.trim() : null;

                if (['builder', 'broker', 'external_sales'].includes(finalRole) && !finalName) {
                    return { error: 'Full name is required to create this account.' };
                }

                if (['builder', 'broker'].includes(finalRole) && !finalAgencyName) {
                    return { error: 'Company / Agency Name is required to create this account.' };
                }

                const uniqueUsername = await generateUniqueUsername(finalName || phone); // Use phone as fallback for username

                const newUserResult = await pool.query(
                    'INSERT INTO users (name, username, account_number, phone, password_hash, role, agency_name, gst_number, rera_number, sales_agent_type, parent_type, is_email_verified, referral_code, referred_by, has_random_password, is_phone_verified, profile_completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11, $12, $13, TRUE, TRUE, FALSE) RETURNING *',
                    [finalName, uniqueUsername, account_number, phone, hash, finalRole, finalAgencyName, gst_number || null, rera_number || null, finalRole === 'external_sales' ? 'independent' : null, false, my_referral_code, referral_code || null] // profile_completed is FALSE
                );

                const newUser = newUserResult.rows[0];
                await addToPasswordHistory(newUser.id, hash);
                await processReferral(referral_code, newUser.id, finalRole);
                return { user: newUser, created: true };
            };

            if (result.rows.length === 0) {
                // Auto-Signup!
                const created = await createWhatsAppUser();
                if (created.error) return res.status(400).json({ error: created.error });
                user = created.user;
                createdNewUser = created.created;
            } else {
                const matchingUsers = result.rows;
                const requestedRole = role && String(role).trim() !== '' ? String(role).trim() : null;
                const isSignupAttempt = Boolean(requestedRole && typeof name === 'string' && name.trim() !== '');

                if (requestedRole) {
                    const roleMatches = matchingUsers.filter(row => row.role === requestedRole);

                    if (roleMatches.length > 0) {
                        user = roleMatches[0];
                    } else if (isSignupAttempt) {
                        const created = await createWhatsAppUser();
                        if (created.error) return res.status(400).json({ error: created.error });
                        user = created.user;
                        createdNewUser = created.created;
                        shouldShowLinkedAccounts = true;
                    }
                }

                if (!user && matchingUsers.length > 1) {
                    const roleMatches = requestedRole ? matchingUsers.filter(row => row.role === requestedRole) : [];

                    if (roleMatches.length > 0) {
                        user = roleMatches[0];
                    } else {
                        const accountTypes = buildAccountTypeOptions(matchingUsers);
                        const hasDuplicateSameType = accountTypes.some(option => option.count > 1);
                        return res.status(409).json({
                            requiresAccountType: true,
                            error: hasDuplicateSameType
                                ? 'Multiple accounts use this phone number. Please select the account type. If the same type appears more than once, contact support.'
                                : 'Multiple accounts use this phone number. Please select which account type you want to continue with.',
                            accountTypes
                        });
                    }
                } else if (!user) {
                    user = matchingUsers[0];
                }

                if (user.is_active === false) {
                    return res.status(403).json({ error: 'Your account has been disabled. Please contact support.' });
                }
                // Auto-generate referral code for legacy accounts
                if (!user.referral_code) {
                    user.referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
                    await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [user.referral_code, user.id]);
                }
            }

            if (!user.is_phone_verified) {
                await pool.query('UPDATE users SET is_phone_verified = TRUE WHERE id = $1', [user.id]);
                user.is_phone_verified = true;
            }

            if (createdNewUser) user.profile_completed = false; // Explicitly set for new users
            delete req.session.whatsappOtp; // Clear the OTP to prevent reuse
            req.session.user = normalizeStandardProfileUser(user);
            req.session.cookie.maxAge = 60 * 60 * 1000; // 1 hour timeout

            const redirectUrl = shouldShowLinkedAccounts
                ? '/edit-profile?message=This+phone+number+has+multiple+accounts.+Select+any+old+account+you+want+to+delete.'
                : loginRedirectPath(user);
            return saveSessionAndRespond(req, res, () => res.json({ success: true, redirect: redirectUrl }));
        } catch (err) {
            console.error("WhatsApp OTP Login Error:", err);
            return res.status(500).json({ error: 'Server error during login.' });
        }
    });

    // Authenticated User Actions
    // NOTE: These routes should be protected by an authentication middleware (e.g., isAuthenticated)

    router.post('/user/send-whatsapp-verification', /* isAuthenticated, */ whatsappOtpLimiter, async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ error: 'You must be logged in to do that.' });
        }
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });

        const now = Date.now();
        let otp;
        let requestCount = 1;

        // Handle existing OTP session for cooldowns and reuse
        if (req.session.whatsappVerificationOtp && req.session.whatsappVerificationOtp.phone === phone) {
            const lastReq = req.session.whatsappVerificationOtp.lastRequestedAt || 0;
            requestCount = req.session.whatsappVerificationOtp.requestCount || 1;
            
            // Cooldown: 30s for the first resend, 60s for subsequent resends
            const waitTime = requestCount === 1 ? 30 * 1000 : 60 * 1000;
            
            if (now - lastReq < waitTime) {
                const remaining = Math.ceil((waitTime - (now - lastReq)) / 1000);
                return res.status(429).json({ error: `Please wait ${remaining} seconds before requesting another OTP.` });
            }

            if (req.session.whatsappVerificationOtp.expires > now) {
                otp = req.session.whatsappVerificationOtp.code;
            } else {
                otp = crypto.randomInt(100000, 999999).toString();
            }
            requestCount += 1;
        } else {
            otp = crypto.randomInt(100000, 999999).toString();
        }

        // Use a different session key to not conflict with login OTP
        req.session.whatsappVerificationOtp = {
            code: otp,
            phone: phone,
            expires: (req.session.whatsappVerificationOtp && req.session.whatsappVerificationOtp.expires > now) ? req.session.whatsappVerificationOtp.expires : now + 10 * 60 * 1000,
            lastRequestedAt: now,
            requestCount: requestCount
        };

        try {
            const waService = require('./whatsappService');
            await waService.sendOtpVerification(phone, otp);

            req.session.save((err) => {
                if (err) console.error("Session save error:", err);
                res.json({ message: 'WhatsApp verification OTP sent successfully' });
            });
        } catch (err) {
            console.error("WhatsApp Verification OTP Send Error:", err);
            const status = err.code === 'WA_PROVIDER_ERROR' || err.code === 'WA_NOT_CONFIGURED' || err.code === 'WA_NUMBER_MISSING'
                ? 503
                : 500;
            res.status(status).json({ error: err.userMessage || 'Failed to send WhatsApp OTP' });
        }
    });

    router.post('/user/verify-whatsapp', /* isAuthenticated, */ whatsappOtpLimiter, async (req, res) => {
        if (!req.session.user) {
            return res.status(401).json({ error: 'You must be logged in to do that.' });
        }
        const { phone, otp } = req.body;
        const userId = req.session.user.id;
        const sessionOtp = req.session.whatsappVerificationOtp;

        if (!sessionOtp || sessionOtp.phone !== phone || Date.now() > sessionOtp.expires || String(sessionOtp.code) !== String(otp)) {
            return res.status(400).json({ error: 'Invalid or expired OTP.' });
        }

        try {
            // Update user's phone and set verification status to true
            await pool.query('UPDATE users SET phone = $1, is_phone_verified = TRUE WHERE id = $2', [phone, userId]);
            req.session.user.phone = phone;
            req.session.user.is_phone_verified = true;
            delete req.session.whatsappVerificationOtp;

            // Check if this action completes a referral
            await checkAndCompleteReferral(userId);

            res.json({ success: true, message: "WhatsApp number verified successfully." });
        } catch (err) {
            console.error("WhatsApp Verification Error:", err);
            return res.status(500).json({ error: 'Server error during WhatsApp verification.' });
        }
    });

    // Auth0 Routes
    router.get('/auth0/login', async (req, res) => {
        const options = {
            returnTo: '/auth0/sync', // Force Auth0 to return here so we can sync with Postgres
            authorizationParams: {
                prompt: 'login', // Forces Auth0 to ask for credentials every time, ignoring active browser sessions
                connection: 'google-oauth2' // Bypass Auth0 login page and go directly to Google
            }
        };
        if (req.query.connection) {
            options.authorizationParams.connection = req.query.connection;
        }
        // Optional: Force Auth0 to show the "Sign Up" tab instead of the "Log In" tab
        if (req.query.action === 'signup') {
            options.authorizationParams.screen_hint = 'signup';
        }
        res.oidc.login(options);
    });

    // Sync Auth0 User with Local Database Session
    router.get('/auth0/sync', async (req, res) => {
        if (!req.oidc || !req.oidc.isAuthenticated()) {
            return res.redirect('/login');
        }

        const auth0User = req.oidc.user;
        try {
            const result = await pool.query('SELECT * FROM users WHERE email = $1', [auth0User.email]);
            if (result.rows.length > 0) {
                const user = result.rows[0];

                // Security & Verification Checks
                if (auth0User.email_verified === true && !user.is_email_verified) {
                    await pool.query('UPDATE users SET is_email_verified = TRUE WHERE id = $1', [user.id]);
                    user.is_email_verified = true;
                }
                if (!user.is_email_verified) {
                    return res.redirect('/auth-error?message=Please+verify+your+email+to+log+in.');
                }
                if (user.is_active === false) {
                    return res.redirect('/auth-error?message=Your+account+has+been+disabled.+Please+contact+support.');
                }

                req.session.user = normalizeStandardProfileUser(user);
                req.session.save(() => {
                    res.redirect('/?login=success');
                });
            } else {
                if (auth0User.email_verified !== true) {
                    return res.redirect('/auth-error?message=Please+verify+your+email+with+your+identity+provider+before+signing+up.');
                }
                req.session.auth0User = auth0User;
                req.session.save(() => {
                    res.redirect('/auth0/select-role');
                });
            }
        } catch (err) {
            console.error("Auth0 Sync Error:", err);
            return res.redirect('/auth-error?message=Sync+Failed');
        }
    });

    router.get('/auth0/select-role', (req, res) => {
        if (!req.session.auth0User) return res.redirect('/login');
        res.render('select-role', { email: req.session.auth0User.email });
    });

    router.post('/auth0/complete-signup', async (req, res) => {
        if (!req.session.auth0User) return res.redirect('/login');
        
        const { role, agency_name, gst_number, rera_number } = req.body;
        const auth0User = req.session.auth0User;
        const email = auth0User.email;
        const name = auth0User.name || auth0User.nickname || null;

        let finalRole = ['tenant', 'owner'].includes(role) ? 'owner' : role;
        if (!['owner', 'broker', 'external_sales'].includes(finalRole)) {
            return res.status(400).send("Invalid role selected.");
        }

        try {
            const account_number = await generateUniqueAccountNumber(false);

            const randomPass = crypto.randomBytes(16).toString('hex');
            const hash = await bcrypt.hash(randomPass, 10);
            const my_referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
            
            const uniqueUsername = await generateUniqueUsername(name || email); // Use email as fallback for username
            
            const newUserResult = await pool.query(
                'INSERT INTO users (name, username, account_number, email, password_hash, role, agency_name, gst_number, rera_number, sales_agent_type, parent_type, is_email_verified, referral_code, referred_by, has_random_password, is_phone_verified, profile_completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, $11, $12, $13, TRUE, FALSE, FALSE) RETURNING *',
                [name, uniqueUsername, account_number, email, hash, finalRole, agency_name || null, gst_number || null, rera_number || null, finalRole === 'external_sales' ? 'independent' : null, true, my_referral_code, req.body.referral_code || null] // profile_completed is FALSE
            );
            const newUser = newUserResult.rows[0];
            await addToPasswordHistory(newUser.id, hash);
            await processReferral(req.body.referral_code, newUser.id, finalRole);
            
            req.session.user = normalizeStandardProfileUser(newUser);
            delete req.session.auth0User;

            req.session.save(() => {
                res.redirect('/');
            });
        } catch (err) {
            console.error("Auth0 Complete Signup Error:", err);
            res.redirect('/auth-error?message=Signup+Failed');
        }
    });

    router.get('/auth-error', (req, res) => {
        res.render('auth-error', { message: req.query.message || 'An unknown error occurred.' });
    });

    router.get('/partner-signup', (req, res) => {
        // If a user is already logged in, redirect with an error message
        // The frontend JS will catch this error query param and show a popup
        if (req.session.user) return res.redirect('/partner-signup?error=' + encodeURIComponent('You are already logged in. Please log out before registering as a partner.'));
        const refCode = req.query.ref || '';
        res.render('partner-signup', { user: req.session.user || null, error: req.query.error || null, message: null, tab: req.query.tab || 'builder', refCode });
    });

    router.post('/signup/check-availability', async (req, res) => {
        try {
            const rawPhone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
            const rawUsername = typeof req.body.username === 'string' ? req.body.username.trim() : '';
            const excludeUserId = Number.isInteger(Number(req.body.excludeUserId)) ? Number(req.body.excludeUserId) : null;
            const errors = {};

            if (rawUsername) {
                const usernameRes = await pool.query(
                    'SELECT id FROM users WHERE lower(username) = lower($1) AND ($2::int IS NULL OR id != $2) LIMIT 1',
                    [rawUsername, excludeUserId]
                );
                if (usernameRes.rows.length > 0) errors.username = 'This username is already taken.';
            }

            if (rawPhone) {
                const digits = rawPhone.replace(/\D/g, '');
                const phoneCandidates = Array.from(new Set([rawPhone, digits.slice(-10)].filter(Boolean)));
                const phoneRes = await pool.query(
                    `SELECT id FROM users
                     WHERE ($1::int IS NULL OR id != $1)
                       AND phone = ANY($2::text[])
                     LIMIT 1`,
                    [excludeUserId, phoneCandidates]
                );
                if (phoneRes.rows.length > 0) errors.phone = 'This phone number is already in use.';
            }

            return res.json({ ok: true, errors });
        } catch (err) {
            console.error('Signup availability check failed:', err);
            return res.status(500).json({ ok: false, error: 'Could not check availability.' });
        }
    });

    // Standard Signup Route
    router.post('/signup', authLimiter, validate(signupSchema, 'partner-signup', 'signup'), async (req, res) => {
        const { name, email, password, role, phone, terms, referral_code, agency_name, gst_number, rera_number } = req.body;
        const isPartner = ['external_sales', 'broker'].includes(role);
        const errorView = isPartner ? 'partner-signup' : 'login'; // Redirect to partner-signup for partner roles, login for others
        const errorTab = ['owner', 'tenant'].includes(role) ? 'owner' : (isPartner ? role : 'signup');

        const captcha = await verifyTurnstile(req);
        if (!captcha.success) {
            return res.render(errorView, { user: null, error: captcha.message, tab: errorTab, refCode: referral_code || '' });
        }
        
        // Zod validation (via `validate` middleware) handles most basic checks
        // Block new signups via email (Task 2)
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.render(errorView, { user: null, error: 'Email already exists. Please login or use WhatsApp for new registrations.', tab: errorTab, refCode: referral_code || '' });
        }
        // Custom password validation from utils.js
        const passwordError = validatePassword(password);
        if (passwordError) return res.render(errorView, { user: null, error: passwordError, tab: errorTab, refCode: referral_code || '' });

        // Role check is handled by Zod enum, ensure finalRole is correctly set
        const finalRole = ['tenant', 'owner'].includes(role) ? 'owner' : role;
        
        // Builder role check (should be handled by separate /signup/builder route) or corporate
        if (role === 'builder') return res.render(errorView, { user: null, error: "Please use the Builder Registration tab.", tab: 'builder', refCode: referral_code || '' });

        const token = crypto.randomBytes(32).toString('hex');
        const hash = await bcrypt.hash(password, 10);
        const my_referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
        const account_number = await generateUniqueAccountNumber(false);
            
        // Generate unique username from name
        const uniqueUsername = await generateUniqueUsername(name);
        
        try {
            const result = await pool.query('INSERT INTO users (name, username, account_number, email, password_hash, role, phone, agency_name, gst_number, rera_number, sales_agent_type, parent_type, verification_token, referral_code, referred_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12, $13, $14) RETURNING id', [name, uniqueUsername, account_number, email, hash, finalRole, phone || null, agency_name || null, gst_number || null, rera_number || null, finalRole === 'external_sales' ? 'independent' : null, token, my_referral_code, referral_code || null]);
            await addToPasswordHistory(result.rows[0].id, hash);
            await processReferral(referral_code, result.rows[0].id, finalRole);

            const verifyLink = buildPublicUrl(req, `/verify-email/${token}`);
            const info = await transporter.sendMail({
                from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: 'Verify your Email - MatrixSpaces',
                text: `Welcome! Please verify your email by clicking the following link: ${verifyLink}`
            });
            console.log("Verification email sent. Preview URL: %s", nodemailer.getTestMessageUrl(info));
            res.redirect('/login');
        } catch (err) { 
            console.error("Signup Error:", err);
            if (err.code === '23505') return res.render(errorView, { user: null, error: 'Email already exists.', tab: errorTab, refCode: referral_code || '' });
            res.render(errorView, { user: null, error: "Error signing up: " + err.message, tab: errorTab, refCode: referral_code || '' });
        }
    });

    router.get('/login', (req, res) => {
        if (req.session.user) {
            return res.redirect('/');
        }
        let message = null;
        if (req.query.logout === 'success') message = 'You have been logged out successfully.';
        else if (req.query.logout === 'timeout') message = 'Your session has expired due to inactivity. Please log in again.';

        const refCode = req.query.ref || '';
        res.render('login', { user: req.session.user || null, error: null, message, tab: req.query.tab || 'login', refCode });
    });

    router.post('/login', authLimiter, validate(loginSchema, 'login', 'login'), async (req, res) => {
        try {
            const loginIdentifier = req.body.email || req.body.username;
            const { password, remember } = req.body;
            const result = await pool.query('SELECT * FROM users WHERE email = $1 OR account_number = $1 OR username = $1', [loginIdentifier]);

            if (result.rows.length > 0) {
                const user = result.rows[0];
                const passwordHash = typeof user.password_hash === 'string' ? user.password_hash : '';

                if (!passwordHash) {
                    const message = 'Password login is not available for this account.';
                    if (wantsJson(req)) {
                        return res.status(401).json({ error: message });
                    }
                    return res.render('login', { user: null, error: message, tab: 'login' });
                }

                if (await bcrypt.compare(password, passwordHash)) {
                    if (user.is_active === false) {
                        if (wantsJson(req)) {
                            return res.status(403).json({ error: 'Your account has been disabled. Please contact support.' });
                        }
                        return res.render('login', { user: null, error: 'Your account has been disabled. Please contact support.', tab: 'login' });
                    }

                    if (!user.is_email_verified && user.role !== 'admin') {
                        if (wantsJson(req)) {
                            return res.status(403).json({ error: 'Please verify your email before logging in.' });
                        }
                        return res.render('login', { user: null, error: 'Please verify your email before logging in. A verification link was sent to your email.', tab: 'login' });
                    }

                    // Post-signup profile completion check (Task 3 & 4)
                    const isDemo = (user.name || '').toLowerCase().includes('demo') || (user.username || '').toLowerCase().includes('demo');
                    if (!isDemo && (user.profile_completed === false || isRandomName(user.name))) {
                        req.session.user = normalizeStandardProfileUser(user);
                        return saveSessionAndRespond(req, res, () => res.redirect('/complete-profile'));
                    }

                    if (user.is_two_factor_enabled) {
                        req.session.temp_2fa_user_id = user.id;
                        req.session.temp_2fa_remember = !!remember;
                        if (wantsJson(req)) {
                            return saveSessionAndRespond(req, res, () => res.json({ requires2FA: true }));
                        }
                        return saveSessionAndRespond(req, res, () => res.render('login-2fa', { error: null }));
                    }

                    if (!user.referral_code) {
                        user.referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
                        await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [user.referral_code, user.id]);
                    }

                    req.session.user = normalizeStandardProfileUser(user);
                    req.session.cookie.maxAge = remember ? 30 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
                    const redirectPath = loginRedirectPath(user);

                    if (wantsJson(req)) {
                        return saveSessionAndRespond(req, res, () => res.json({ success: true, user: normalizeStandardProfileUser(user), redirect: redirectPath }));
                    }

                    return saveSessionAndRespond(req, res, () => res.redirect(redirectPath));
                }
            }

            if (wantsJson(req)) {
                return res.status(401).json({ error: 'Invalid email, account number, or password' });
            }
            return res.render('login', { user: null, error: 'Invalid email, account number, or password', tab: 'login' });
        } catch (error) {
            console.error('Login Error:', error);
            const message = 'Unable to complete login right now. Please try again.';
            if (wantsJson(req)) {
                return res.status(500).json({ error: message });
            }
            return res.render('login', { user: null, error: message, tab: 'login' });
        }
    });

    router.post('/login/2fa', authLimiter, async (req, res) => {
        try {
            if (!req.session.temp_2fa_user_id) return res.redirect('/login');
            const { token } = req.body;
            
            const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.temp_2fa_user_id]);
            if (userRes.rows.length === 0) return res.redirect('/login');
            const user = userRes.rows[0];
            
            let verified = speakeasy.totp.verify({ secret: user.two_factor_secret, encoding: 'base32', token });

            if (!verified) {
                const recoveryCodes = JSON.parse(user.recovery_codes || '[]');
                for (let i = 0; i < recoveryCodes.length; i++) {
                    if (await bcrypt.compare(token, recoveryCodes[i])) {
                        verified = true;
                        recoveryCodes.splice(i, 1);
                        await pool.query('UPDATE users SET recovery_codes = $1 WHERE id = $2', [JSON.stringify(recoveryCodes), user.id]);
                        break;
                    }
                }
            }
            
            if (verified) {
                req.session.user = normalizeStandardProfileUser(user);
                req.session.cookie.maxAge = req.session.temp_2fa_remember ? 30 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
                delete req.session.temp_2fa_user_id;
                delete req.session.temp_2fa_remember;

                return saveSessionAndRespond(req, res, () => res.redirect('/'));
            }

            return res.render('login-2fa', { error: 'Invalid authentication code or recovery code' });
        } catch (error) {
            console.error('2FA Login Error:', error);
            return res.render('login-2fa', { error: 'Unable to complete two-factor login right now.' });
        }
    });

    router.get('/logout', (req, res) => {
        if (!req.session.user && (!req.oidc || !req.oidc.isAuthenticated())) return res.redirect('/login');
        res.render('logout-confirm');
    });

    router.post('/logout', async (req, res) => { 
        const isAuth0 = req.oidc && req.oidc.isAuthenticated();
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['host'];
        const returnMsg = req.query.timeout ? 'timeout' : 'success';
        const returnTo = `${protocol}://${host}/`;

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        req.session.destroy(async (err) => {
            if (err) console.error("Session destroy error:", err);
            res.clearCookie('connect.sid', { path: '/' });
            if (isAuth0) await res.oidc.logout({ returnTo });
            else res.redirect('/');
        });
    });

    router.post('/signup/builder', authLimiter, uploadKyc.fields([{ name: 'aadhaar', maxCount: 1 }, { name: 'pan', maxCount: 1 }, { name: 'license', maxCount: 1 }, { name: 'passport', maxCount: 1 }]), validate(builderSignupSchema, 'partner-signup', 'builder'), async (req, res) => {
        const { name, email, password, phone, agency_name, gst_number, rera_number, terms, referral_code } = req.body;
        const captcha = await verifyTurnstile(req);
        if (!captcha.success) {
            return res.render('partner-signup', { user: null, error: captcha.message, tab: 'builder', refCode: referral_code || '' });
        }

        const passwordError = validatePassword(password);
        if (passwordError) return res.render('partner-signup', { user: null, error: passwordError, tab: 'builder', refCode: referral_code || '' });
        
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.render('partner-signup', { user: null, error: 'Email already exists. Please login or use WhatsApp for new registrations.', tab: 'builder', refCode: referral_code || '' });
        }

        const files = req.files || {};

        const hash = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(32).toString('hex');
        const my_referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
        const account_number = await generateUniqueAccountNumber(false); // For builder, not admin
        
        const uniqueUsername = await generateUniqueUsername(name);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const userRes = await client.query('INSERT INTO users (name, username, account_number, email, password_hash, role, phone, agency_name, gst_number, rera_number, verification_token, referral_code, referred_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id', [name, uniqueUsername, account_number, email, hash, 'builder', phone || null, agency_name, gst_number || null, rera_number || null, token, my_referral_code, referral_code || null]);
            const userId = userRes.rows[0].id; // profile_completed is FALSE by default
            await client.query("UPDATE users SET password_history = $1 WHERE id = $2", [JSON.stringify([hash]), userId]);
            await processReferral(referral_code, userId, 'builder', client);

            for (const doc of ['aadhaar', 'pan', 'license', 'passport']) {
                if (files[doc] && files[doc][0]) {
                    await client.query('INSERT INTO kyc_docs (user_id, doc_type, file_path) VALUES ($1, $2, $3)', [userId, doc, files[doc][0].filename]);
                }
            }
            await client.query('COMMIT');

            const verifyLink = buildPublicUrl(req, `/verify-email/${token}`);
            const info = await transporter.sendMail({
                from: '"MatrixSpaces" <admin@matrixspaces.com>',
                to: email,
                subject: 'Verify your Email - MatrixSpaces',
                text: `Welcome! Please verify your email by clicking the following link: ${verifyLink}`
            });
            console.log("Builder verification email sent. Preview URL: %s", nodemailer.getTestMessageUrl(info));
            res.redirect('/login');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Builder Signup Error:", err);
            let errorMessage = "Error signing up builder: " + err.message;
            if (err.code === '23505') {
                errorMessage = 'A user with that email already exists.';
            }
            res.render('partner-signup', { user: null, error: errorMessage, tab: 'builder', refCode: referral_code || '' });
        } finally {
            client.release();
        }
    });

    router.post('/signup/corporate', authLimiter, async (req, res) => {
        let { name, email, password, phone, corporate_type, corporate_type_other, company_name, terms, referral_code } = req.body;
        if (corporate_type === 'Other' && corporate_type_other) corporate_type = corporate_type_other;
        if (!name || !email || !password || !corporate_type || !company_name) return res.render('login', { user: null, error: "All fields are required for corporate registration.", tab: 'corporate' });
        if (!terms) return res.render('login', { user: null, error: "You must agree to the Terms of Service.", tab: 'corporate' });

        const passwordError = validatePassword(password);
        const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.render('login', { user: null, error: 'Email already exists. Please login or use WhatsApp for new registrations.', tab: 'corporate' });
        }

        if (passwordError) return res.render('login', { user: null, error: passwordError, tab: 'corporate' });

        const hash = await bcrypt.hash(password, 10);
        const token = crypto.randomBytes(32).toString('hex');
        const my_referral_code = crypto.randomBytes(4).toString('hex').toUpperCase();
        const account_number = await generateUniqueAccountNumber(false);

        if (phone && !/^\+?\d{7,20}$/.test(phone)) return res.render(errorView, { user: null, error: "Invalid phone number format.", tab: errorTab, refCode: referral_code || '' });

        const uniqueUsername = await generateUniqueUsername(name);

        try {
            const result = await pool.query('INSERT INTO users (name, username, account_number, email, password_hash, role, phone, agency_name, corporate_type, verification_token, is_domain_approved, referral_code, referred_by, profile_completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, FALSE) RETURNING id', [name, uniqueUsername, account_number, email, hash, 'corporate', phone || null, company_name, corporate_type, token, false, my_referral_code, referral_code || null]); // profile_completed is FALSE
            await addToPasswordHistory(result.rows[0].id, hash);
            await processReferral(referral_code, result.rows[0].id, 'corporate');

            const verifyLink = buildPublicUrl(req, `/verify-email/${token}`);
            const info = await transporter.sendMail({
                from: '"MatrixSpaces" <admin@matrixspaces.com>',
                to: email,
                subject: 'Verify your Corporate Email - MatrixSpaces',
                text: `Welcome to MatrixSpaces Corporate! Please verify your email: ${verifyLink}\n\nNote: Your domain access will be pending admin approval after verification.`
            });
            console.log("Corporate verification email sent. Preview URL: %s", nodemailer.getTestMessageUrl(info));
            res.redirect('/login');
        } catch (err) {
            console.error("Corporate Signup Error:", err);
            let errorMessage = "Error signing up: " + err.message;
            if (err.code === '23505') {
                errorMessage = 'A user with that email already exists.';
            }
            res.render('login', { user: null, error: errorMessage, tab: 'corporate' });
        }
    });

    router.get('/verify-email/:token', async (req, res) => {
        const { token } = req.params;
        try {
            const result = await pool.query('UPDATE users SET is_email_verified = TRUE, verification_token = NULL WHERE verification_token = $1 RETURNING id', [token]);
            if (result.rows.length > 0) {
                res.render('login', { user: null, error: null, message: "Email verified successfully! Please login.", tab: 'login' });
            } else {
                res.render('login', { user: null, error: "Invalid or expired verification token.", tab: 'login' });
            }
        } catch (err) {
            console.error(err);
            res.redirect('/login');
        }
    });

    router.get('/forgot-password', (req, res) => {
        res.render('forgot-password', { error: null, message: null });
    });

    router.post('/forgot-password', authLimiter, async (req, res) => {
        const { email } = req.body;
        try {
            const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            if (userRes.rows.length > 0) {
                const token = crypto.randomBytes(32).toString('hex');
                const expires = new Date(Date.now() + 3600000); // 1 hour
                await pool.query('UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3', [token, expires, userRes.rows[0].id]);

                const resetLink = buildPublicUrl(req, `/reset-password/${token}`);
                const info = await transporter.sendMail({
                    from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Password Reset Request',
                    text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n${resetLink}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`
                });
                console.log("Password reset email sent. Preview URL: %s", nodemailer.getTestMessageUrl(info));
            }
            res.render('forgot-password', { error: null, message: 'If an account with that email exists, a reset link has been sent.' });
        } catch (err) {
            console.error(err);
            res.render('forgot-password', { error: 'An error occurred. Please try again.', message: null });
        }
    });

    router.get('/reset-password/:token', async (req, res) => {
        const { token } = req.params;
        const userRes = await pool.query('SELECT id FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()', [token]);
        if (userRes.rows.length === 0) {
            return res.render('forgot-password', { error: 'Password reset token is invalid or has expired.', message: null });
        }
        res.render('reset-password', { token, error: null });
    });

    router.post('/reset-password/:token', authLimiter, async (req, res) => {
        const { token } = req.params;
        const { password } = req.body;
        
        const passwordError = validatePassword(password);
        if (passwordError) return res.render('reset-password', { token, error: passwordError });

        const userRes = await pool.query('SELECT id FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()', [token]);
        if (userRes.rows.length === 0) return res.render('forgot-password', { error: 'Password reset token is invalid or has expired.', message: null });

        if (await isPasswordReused(userRes.rows[0].id, password)) {
            return res.render('reset-password', { token, error: "You cannot reuse your last 3 passwords." });
        }

        const hash = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2', [hash, userRes.rows[0].id]);
        await addToPasswordHistory(userRes.rows[0].id, hash);
        
        res.render('login', { user: null, error: null, message: "Password has been reset. Please login.", tab: 'login' });
    });

    router.post('/resend-verification', async (req, res) => {
        if (!req.session.user || !req.session.user.email) {
            return res.redirect('/login');
        }

        if (req.session.user.is_email_verified) {
            return res.redirect('/?message=Your+email+is+already+verified.');
        }

        try {
            const token = crypto.randomBytes(32).toString('hex');
            await pool.query('UPDATE users SET verification_token = $1 WHERE id = $2', [token, req.session.user.id]);

            const verifyLink = buildPublicUrl(req, `/verify-email/${token}`);
            await transporter.sendMail({
                from: `"MatrixSpaces" <${process.env.EMAIL_USER}>`,
                to: req.session.user.email,
                subject: 'Verify your Email - MatrixSpaces',
                text: `Please verify your email by clicking the following link: ${verifyLink}`
            });
            res.redirect(req.get('Referer') || '/?message=Verification+link+sent!');
        } catch (err) { console.error("Resend verification error:", err); res.redirect(req.get('Referer') || '/?error=Could+not+resend+link.'); }
    });

    return router;
};
