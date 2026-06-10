const pool = require('../db');

async function getParentApproval(parentId) {
    const result = await pool.query(
        'SELECT is_domain_approved FROM users WHERE id = $1',
        [parentId]
    );
    return result.rows[0] || null;
}

async function getSubordinates(corporateId) {
    const result = await pool.query(
        'SELECT * FROM users WHERE parent_id = $1',
        [corporateId]
    );
    return result.rows;
}

async function getCorporateBranding(parentId) {
    const result = await pool.query(
        'SELECT agency_name, corporate_type, company_logo FROM users WHERE id = $1',
        [parentId]
    );
    return result.rows[0] || null;
}

async function getCorporateManager(corporateId) {
    const managerLinkRes = await pool.query(
        'SELECT rm_id FROM users WHERE id = $1',
        [corporateId]
    );
    if (managerLinkRes.rows.length === 0 || !managerLinkRes.rows[0].rm_id) return null;

    const managerRes = await pool.query(
        'SELECT username, email, phone FROM users WHERE id = $1',
        [managerLinkRes.rows[0].rm_id]
    );
    return managerRes.rows[0] || null;
}

async function getCorporateRequirements(corporateId) {
    const result = await pool.query(
        'SELECT * FROM corporate_requirements WHERE corporate_id = $1 ORDER BY created_at DESC',
        [corporateId]
    );
    return result.rows;
}

async function getRequirementSuggestions(corporateId) {
    const result = await pool.query(
        `SELECT rs.*, p.title as property_title, p.locality, p.final_price, p.type, p.photos, cr.cities as req_cities, cr.property_type as req_type
         FROM requirement_suggestions rs
         JOIN properties p ON rs.property_id = p.id
         JOIN corporate_requirements cr ON rs.requirement_id = cr.id
         WHERE cr.corporate_id = $1 AND rs.status = 'approved'
         ORDER BY rs.created_at DESC`,
        [corporateId]
    );
    return result.rows;
}

async function getTeamShortlist(corporateId) {
    const result = await pool.query(
        `SELECT p.id, p.title, p.locality, p.final_price, p.type, p.status, p.photos, u.username as added_by
         FROM properties p
         JOIN favorites f ON p.id = f.property_id
         JOIN users u ON f.user_id = u.id
         WHERE f.user_id = $1 OR f.user_id IN (SELECT id FROM users WHERE parent_id = $1)`,
        [corporateId]
    );
    return result.rows;
}

async function getCorporateVisits(userId) {
    const result = await pool.query(
        `SELECT v.*, p.title as property_title, p.locality, p.photos, u.username as scheduled_by, a.username as agent_name, parent.username as parent_name
         FROM visits v
         JOIN properties p ON v.property_id = p.id
         JOIN users u ON v.user_id = u.id
         LEFT JOIN users a ON v.agent_id = a.id
         LEFT JOIN users parent ON a.parent_id = parent.id
         WHERE v.user_id = $1 OR v.user_id IN (SELECT id FROM users WHERE parent_id = $1)
         ORDER BY v.scheduled_at DESC`,
        [userId]
    );
    return result.rows;
}

async function createCorporateUser({ name, username, email, passwordHash, phone, parentId }) {
    const result = await pool.query(
        `INSERT INTO users (name, username, email, password_hash, role, phone, parent_id, is_domain_approved, is_email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [name, username, email, passwordHash, 'corporate_user', phone, parentId, true, true]
    );
    return result.rows[0] || null;
}

async function createCorporateRequirement({ corporateId, cities, locality, propertyType, minSize, budget, description }) {
    await pool.query(
        'INSERT INTO corporate_requirements (corporate_id, cities, locality, property_type, min_size, budget, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [corporateId, cities, locality, propertyType, minSize, budget, description]
    );
}

async function createSharedRequirement({ corporateId, cities, locality, propertyType, requirementType, description, minSize, budget }) {
    await pool.query(
        `INSERT INTO corporate_requirements (corporate_id, cities, locality, property_type, requirement_type, description, min_size, budget, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [corporateId, cities, locality, propertyType, requirementType, description, minSize, budget, 'active']
    );
}

async function deleteUserRequirement({ requirementId, userId }) {
    await pool.query(
        'DELETE FROM corporate_requirements WHERE id = $1 AND corporate_id = $2',
        [requirementId, userId]
    );
}

async function updateCorporateProfile({ userId, agencyName, corporateType, companyLogo }) {
    await pool.query(
        'UPDATE users SET agency_name = $1, corporate_type = $2, company_logo = $3 WHERE id = $4',
        [agencyName, corporateType, companyLogo, userId]
    );
}

module.exports = {
    getParentApproval,
    getSubordinates,
    getCorporateBranding,
    getCorporateManager,
    getCorporateRequirements,
    getRequirementSuggestions,
    getTeamShortlist,
    getCorporateVisits,
    createCorporateUser,
    createCorporateRequirement,
    createSharedRequirement,
    deleteUserRequirement,
    updateCorporateProfile
};
