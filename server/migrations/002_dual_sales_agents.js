async function migrateDualSalesAgents(pool) {
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS sales_agent_type VARCHAR(20)");
    await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_type VARCHAR(20)");

    await pool.query(`
        UPDATE users
        SET sales_agent_type = CASE
            WHEN parent_id IS NULL THEN 'independent'
            ELSE 'associated'
        END
        WHERE role = 'external_sales'
          AND (sales_agent_type IS NULL OR sales_agent_type = '')
    `);

    await pool.query(`
        UPDATE users child
        SET parent_type = CASE
            WHEN parent.role IN ('broker', 'builder') THEN parent.role
            ELSE parent.role
        END
        FROM users parent
        WHERE child.role = 'external_sales'
          AND child.parent_id = parent.id
          AND (child.parent_type IS NULL OR child.parent_type = '')
    `);

    await pool.query("UPDATE users SET parent_type = NULL WHERE role = 'external_sales' AND parent_id IS NULL");
    await pool.query(`
        CREATE TABLE IF NOT EXISTS property_management_requests (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            responded_at TIMESTAMP
        )
    `);
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_sales_agent_type ON users(role, sales_agent_type)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_users_sales_parent ON users(parent_id, sales_agent_type)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_property_management_requests_agent ON property_management_requests(agent_id, status)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_property_management_requests_property ON property_management_requests(property_id)");
}

module.exports = migrateDualSalesAgents;
