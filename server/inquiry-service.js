const pool = require('./db');

async function logContactInquiry({ propertyId, requesterId, requesterEmail, managerId, channel, req }) {
    await pool.query(
        `INSERT INTO contact_inquiries (
            property_id, requester_id, requester_email, manager_id, channel, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
            propertyId,
            requesterId || null,
            requesterEmail || null,
            managerId || null,
            channel || 'contact_request',
            req ? req.ip : null,
            req ? req.get('user-agent') : null
        ]
    );
}

async function createLeadForInquiry({ managerId, requester, property, preferencesPrefix }) {
    if (!managerId || !requester || !property) return null;
    if (Number(managerId) === Number(requester.id)) return null;

    const email = requester.email || '';
    if (email) {
        const existingLead = await pool.query(
            'SELECT id FROM leads WHERE agent_id = $1 AND email = $2 AND property_id = $3 LIMIT 1',
            [managerId, email, property.id]
        );
        if (existingLead.rows.length) return existingLead.rows[0].id;
    }

    const leadType = property.listing_type === 'sale' ? 'buyer' : 'renter';
    const preferences = `${preferencesPrefix || 'Explicit inquiry'}: ${property.title || 'Property'} (Property ID: ${property.id})`;

    const result = await pool.query(
        `INSERT INTO leads (agent_id, name, phone, email, type, preferences, property_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'new')
         RETURNING id`,
        [
            managerId,
            requester.username || requester.name || requester.email || 'MatrixSpaces User',
            requester.phone || '',
            email,
            leadType,
            preferences,
            property.id
        ]
    );

    return result.rows[0] ? result.rows[0].id : null;
}

module.exports = {
    logContactInquiry,
    createLeadForInquiry
};
