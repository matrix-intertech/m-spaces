async function migratePublicListingIndexes(pool) {
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_properties_public_listed_newest
        ON properties(status, listed_at DESC, id DESC)
        WHERE status = 'listed'
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_properties_public_listing_type_newest
        ON properties(listing_type, listed_at DESC, id DESC)
        WHERE status = 'listed'
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_properties_public_price
        ON properties(final_price)
        WHERE status = 'listed' AND final_price IS NOT NULL
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_properties_public_verified_newest
        ON properties(is_matrix_verified, listed_at DESC, id DESC)
        WHERE status = 'listed'
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_public_partner_directory
        ON users(role, is_active, username)
        WHERE role IN ('builder', 'broker', 'dealer', 'agent', 'external_sales')
    `);
}

module.exports = migratePublicListingIndexes;
