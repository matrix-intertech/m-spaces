async function migratePhase3SchemaGovernance(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_reviews (
            id SERIAL PRIMARY KEY,
            target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_reviews_target_user_id ON user_reviews(target_user_id)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS partner_follows (
            follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            partner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (follower_id, partner_id)
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_partner_follows_partner_id ON partner_follows(partner_id)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS contact_inquiries (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            requester_email TEXT,
            manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            channel VARCHAR(30) DEFAULT 'contact_request',
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_inquiries_property_time ON contact_inquiries(property_id, created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_inquiries_requester_time ON contact_inquiries(requester_id, created_at DESC)`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS property_assignments (
            id SERIAL PRIMARY KEY,
            property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            assignment_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'property_assignments_status_check'
            ) THEN
                ALTER TABLE property_assignments
                ADD CONSTRAINT property_assignments_status_check
                CHECK (status IN ('active', 'inactive', 'removed'));
            END IF;
        END $$;
    `);
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_property_assignments_active_unique
        ON property_assignments(property_id, user_id, assignment_type, status)
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_property_assignments_property_status ON property_assignments(property_id, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_property_assignments_user_status ON property_assignments(user_id, status)`);

    await pool.query(`DELETE FROM property_assignments WHERE status = 'active'`);
    await pool.query(`
        INSERT INTO property_assignments (property_id, user_id, assignment_type, status)
        SELECT p.id,
               p.owner_id,
               'owner',
               'active'
        FROM properties p
        WHERE p.owner_id IS NOT NULL
        ON CONFLICT DO NOTHING
    `);

    await pool.query(`
        INSERT INTO property_assignments (property_id, user_id, assignment_type, status)
        SELECT p.id,
               u.id,
               CASE
                   WHEN u.role = 'builder' THEN 'builder'
                   WHEN u.role = 'broker' THEN 'broker'
                   WHEN u.role = 'external_sales' AND COALESCE(u.sales_agent_type, CASE WHEN u.parent_id IS NULL THEN 'independent' ELSE 'associated' END) = 'associated' THEN 'associated_sales_agent'
                   WHEN u.role = 'external_sales' THEN 'independent_sales_agent'
                   ELSE COALESCE(NULLIF(u.role, ''), 'manager')
               END,
               'active'
        FROM properties p
        JOIN users u
          ON u.id = ANY(
              ARRAY(
                  SELECT DISTINCT assigned_id
                  FROM unnest(
                      CASE
                          WHEN p.assigned_broker_id IS NOT NULL THEN array_append(COALESCE(p.assigned_brokers, '{}'::int[]), p.assigned_broker_id)
                          ELSE COALESCE(p.assigned_brokers, '{}'::int[])
                      END
                  ) AS assigned_id
              )
          )
        ON CONFLICT DO NOTHING
    `);
}

module.exports = migratePhase3SchemaGovernance;
