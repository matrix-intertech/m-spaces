const bcrypt = require('bcrypt');
const pool = require('./db');

function validatePassword(password) {
    if (!password) return "Password cannot be empty.";
    if (password.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
    if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character.";
    return null;
}

// A small, illustrative list of disposable email domains.
// In a production environment, this would be a much larger, regularly updated list
// or an external service (e.g., Mailcheck, Mailgun's email validation).
const DISPOSABLE_EMAIL_DOMAINS = [
    'mailinator.com', 'temp-mail.org', 'guerrillamail.com', '10minutemail.com',
    'yopmail.com', 'trashmail.com', 'anonbox.net', 'disposable.com'
];

function isDisposableEmail(email) {
    if (!email) return false;
    const domain = email.split('@')[1];
    return DISPOSABLE_EMAIL_DOMAINS.includes(domain.toLowerCase());
}

async function isPasswordReused(userId, newPassword) {
    const res = await pool.query('SELECT password_history FROM users WHERE id = $1', [userId]);
    if (res.rows.length === 0) return false;
    
    let history = [];
    try {
        history = JSON.parse(res.rows[0].password_history || '[]');
    } catch (e) { history = []; }

    for (const hash of history) {
        if (await bcrypt.compare(newPassword, hash)) {
            return true;
        }
    }
    return false;
}

async function addToPasswordHistory(userId, newHash) {
    const res = await pool.query('SELECT password_history FROM users WHERE id = $1', [userId]);
    let history = [];
    try {
        history = JSON.parse(res.rows[0].password_history || '[]');
    } catch (e) { history = []; }

    history.unshift(newHash);
    if (history.length > 3) history = history.slice(0, 3);

    await pool.query('UPDATE users SET password_history = $1 WHERE id = $2', [JSON.stringify(history), userId]);
}

async function generateUniqueUsername(name) {
    const baseUsername = (name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    let uniqueUsername = baseUsername || 'user';
    let counter = 1;
    while (true) {
        const checkRes = await pool.query('SELECT id FROM users WHERE username = $1', [uniqueUsername]);
        if (checkRes.rows.length === 0) break;
        uniqueUsername = `${baseUsername}${counter}`;
        counter++;
    }
    return uniqueUsername;
}

function isRandomName(name) {
    if (!name) return true;
    const lowerName = name.toLowerCase();
    // Heuristics for random/auto-generated names
    const randomPatterns = [
        /^user\d+$/, // e.g., user12345
        /^testuser\d*$/, // e.g., testuser, testuser1
        /^[a-z]{3,5}$/, // e.g., abc, qwerty (short, common random strings)
        /^\d+$/, // numbers only
        /^(temp|guest|anon)\d*$/, // temporary, guest, anonymous
        /^(matrixspaces|matrix)\d*$/ // platform-specific auto-generated
    ];
    return randomPatterns.some(pattern => pattern.test(lowerName)) || lowerName.length < 3;
}


module.exports = { validatePassword, isPasswordReused, addToPasswordHistory, generateUniqueUsername, isDisposableEmail, isRandomName };