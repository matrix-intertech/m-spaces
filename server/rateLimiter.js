const rateLimit = require('express-rate-limit');

/**
 * Strict rate limiter for authentication routes (Login, OTP, Password Reset)
 * Prevents brute-force credential stuffing and OTP spamming.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 failed login/OTP requests per window
    message: {
        error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * General API rate limiter to protect public endpoints (e.g., search, listings)
 * Prevents scraping and basic DoS.
 */
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per `window`
    message: {
        error: 'Too many requests, please slow down.'
    }
});

module.exports = {
    authLimiter,
    apiLimiter
};