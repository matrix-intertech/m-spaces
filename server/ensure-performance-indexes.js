const pool = require('./db');

let ensurePromise = null;

async function ensurePerformanceIndexes() {
    if (ensurePromise) return ensurePromise;

    ensurePromise = (async () => {
        const statements = [
            "CREATE INDEX IF NOT EXISTS idx_users_email_lookup ON users(email)",
            "CREATE INDEX IF NOT EXISTS idx_users_account_number_lookup ON users(account_number)",
            "CREATE INDEX IF NOT EXISTS idx_users_username_lookup ON users(username)",
            "CREATE INDEX IF NOT EXISTS idx_users_role_created_at ON users(role, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_users_role_is_active_created_at ON users(role, is_active, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_properties_status_listed_at ON properties(status, listed_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_properties_status_listing_type_listed_at ON properties(status, listing_type, listed_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_properties_verification_status_created_at ON properties(verification_status, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_properties_owner_created_at ON properties(owner_id, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_visits_status_scheduled_at ON visits(status, scheduled_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_visits_agent_scheduled_at ON visits(agent_id, scheduled_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_kyc_docs_status_user_id ON kyc_docs(status, user_id)",
            "CREATE INDEX IF NOT EXISTS idx_referrals_status_created_at ON referrals(status, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created_at ON withdrawals(status, created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_property_conversations_property_last_message_at ON property_conversations(property_id, last_message_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_property_conversations_last_message_at ON property_conversations(last_message_at DESC)"
        ];

        for (const statement of statements) {
            try {
                await pool.query(statement);
            } catch (error) {
                console.warn('[DB] Performance index warning:', error.message);
            }
        }
    })();

    return ensurePromise;
}

module.exports = ensurePerformanceIndexes;
