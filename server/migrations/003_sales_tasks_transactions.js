async function migrateSalesTasksAndTransactions(pool) {
    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'users_sales_agent_type_check'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT users_sales_agent_type_check
                CHECK (sales_agent_type IN ('associated', 'independent') OR sales_agent_type IS NULL);
            END IF;
        END $$;
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'users_parent_type_check'
            ) THEN
                ALTER TABLE users
                ADD CONSTRAINT users_parent_type_check
                CHECK (parent_type IN ('broker', 'builder') OR parent_type IS NULL);
            END IF;
        END $$;
    `);

    await pool.query(`
        ALTER TABLE property_management_requests
        ADD COLUMN IF NOT EXISTS notes TEXT
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'property_management_requests_status_check'
            ) THEN
                ALTER TABLE property_management_requests
                ADD CONSTRAINT property_management_requests_status_check
                CHECK (status IN ('pending', 'accepted', 'rejected'));
            END IF;
        END $$;
    `);

    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_property_management_requests_unique_pending
        ON property_management_requests(property_id, agent_id)
        WHERE status = 'pending'
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS agent_tasks (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
            assigned_to INTEGER REFERENCES users(id) ON DELETE CASCADE,
            parent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            related_property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
            related_lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
            status VARCHAR(20) DEFAULT 'pending',
            due_at TIMESTAMP,
            completed_at TIMESTAMP,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'agent_tasks_status_check'
            ) THEN
                ALTER TABLE agent_tasks
                ADD CONSTRAINT agent_tasks_status_check
                CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));
            END IF;
        END $$;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS sales_transactions (
            id SERIAL PRIMARY KEY,
            agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
            counterparty_name VARCHAR(255),
            amount NUMERIC(14, 2),
            stage VARCHAR(30) DEFAULT 'initiated',
            status VARCHAR(20) DEFAULT 'pending',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'sales_transactions_status_check'
            ) THEN
                ALTER TABLE sales_transactions
                ADD CONSTRAINT sales_transactions_status_check
                CHECK (status IN ('pending', 'confirmed', 'closed', 'cancelled'));
            END IF;
        END $$;
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned_to_status ON agent_tasks(assigned_to, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_by ON agent_tasks(created_by)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent_id ON agent_tasks(parent_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sales_transactions_agent_status ON sales_transactions(agent_id, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sales_transactions_property_id ON sales_transactions(property_id)`);
}

module.exports = migrateSalesTasksAndTransactions;
