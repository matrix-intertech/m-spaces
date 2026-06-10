const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function getTurnstileSecret() {
    return process.env.TURNSTILE_SECRET_KEY || '';
}

function getTurnstileSiteKey() {
    return process.env.TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
}

function isTurnstileEnabled() {
    return Boolean(getTurnstileSecret());
}

async function verifyTurnstile(req) {
    const secret = getTurnstileSecret();
    if (!secret) return { success: true, skipped: true };

    const token = req.body && req.body['cf-turnstile-response'];
    if (!token) {
        return { success: false, message: 'Please complete the captcha challenge.' };
    }

    try {
        const response = await fetch(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret,
                response: token,
                remoteip: req.ip || ''
            })
        });
        const payload = await response.json().catch(() => ({}));
        if (response.ok && payload.success) return { success: true };
        return { success: false, message: 'Captcha verification failed. Please try again.' };
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return { success: false, message: 'Captcha verification is temporarily unavailable. Please try again.' };
    }
}

module.exports = {
    getTurnstileSiteKey,
    isTurnstileEnabled,
    verifyTurnstile
};
