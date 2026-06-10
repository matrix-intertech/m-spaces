const pool = require('./db');

module.exports = async function initializeDatabase() {
    try {
        // Ensure Users table exists with core columns
        await pool.query(`CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT,
            role VARCHAR(50) DEFAULT 'tenant',
            phone TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        // Add core columns if table exists but they are missing
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_number VARCHAR(7) UNIQUE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS has_random_password BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(100) UNIQUE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by VARCHAR(100)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS locality VARCHAR(100)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS rera_number VARCHAR(100)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE"); 
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name_last_changed TIMESTAMP");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE");
        
        // Builder Profile Enhancements
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_about TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_website TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_social_links JSONB DEFAULT '{}'::jsonb");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS office_locations JSONB DEFAULT '[]'::jsonb");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'Unverified'");

        // --- Data Migration for username -> name ---
        try {
            // Make username and password_hash nullable to allow new signups that don't use it.
            await pool.query("ALTER TABLE users ALTER COLUMN username DROP NOT NULL");
            await pool.query("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL");
        } catch (e) {
            // Ignore error if it's already nullable or constraint doesn't exist
            if (e.code !== '42704' && !e.message.includes('does not exist')) { console.log("Notice: Could not make columns nullable (might be OK):", e.message); }
        }
        // Copy existing usernames to the new 'name' field for display purposes.
        await pool.query("UPDATE users SET name = username WHERE name IS NULL AND username IS NOT NULL").catch(e => console.log("Notice: Could not migrate username to name.", e.message));

        try {
            // Expand limits for existing tables to prevent crashes with long strings
            await pool.query("ALTER TABLE users ALTER COLUMN referral_code TYPE VARCHAR(100)");
            await pool.query("ALTER TABLE users ALTER COLUMN referred_by TYPE VARCHAR(100)");
            await pool.query("ALTER TABLE visits ALTER COLUMN contact_number TYPE VARCHAR(50)");
            await pool.query("ALTER TABLE whatsapp_logs ALTER COLUMN phone TYPE VARCHAR(50)");
        } catch(e) {}

        // Ensure Saksh bot user exists (now that password_hash is nullable)
        await pool.query(`
            INSERT INTO users (username, role, name, is_active)
            VALUES ('Saksh', 'support', 'Saksh Bot', TRUE)
            ON CONFLICT (username) DO NOTHING
        `);

        // Referral Tracking Table
        await pool.query(`CREATE TABLE IF NOT EXISTS referrals (
            id SERIAL PRIMARY KEY,
            referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            referred_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(20) DEFAULT 'pending',
            amount DECIMAL(12, 2) DEFAULT 50,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_type VARCHAR(50) DEFAULT 'user'");
        await pool.query("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referral_role VARCHAR(50)");

        // Withdrawals Table for referral payouts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                amount DECIMAL(10,2) NOT NULL,
                payment_details TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `).catch(e => console.error("Notice: Could not create withdrawals table (might be OK):", e.message));

        // Permissions System Tables & Seeding
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS permissions (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(50) UNIQUE NOT NULL,
                    description TEXT
                );
                CREATE TABLE IF NOT EXISTS role_permissions (
                    role_name VARCHAR(50) NOT NULL,
                    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
                    PRIMARY KEY (role_name, permission_id)
                );
                CREATE TABLE IF NOT EXISTS user_permissions (
                    user_id INT REFERENCES users(id) ON DELETE CASCADE,
                    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
                    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
                    PRIMARY KEY (user_id, permission_id)
                );
            `);
            
            const defaultPerms = [
                ['view_overview', 'Dashboard Overview & Pending Approvals'],
                ['manage_properties', 'Approve, Edit, and Delete Properties'],
                ['view_messages', 'View and Reply to Support Chats'],
                ['manage_kyc', 'Approve or Reject Dealer KYC'],
                ['manage_visits', 'Schedule and Assign Property Visits'],
                ['manage_corporate', 'Manage Corporate Clients & Requirements'],
                ['view_users', 'View User Database'],
                ['manage_users', 'Create and Delete User Accounts'],
                ['manage_sales', 'Assign Leads & Manage Sales Tasks'],
                ['manage_permissions', 'Modify Role and User Access Permissions'],
                ['manage_team', 'Add and Manage Team Members'],
                ['manage_referrals', 'Manage Referral Payouts & Tracking'],
                ['manage_bot', 'Add, Edit, or Delete Saksh Bot Responses'],
                ['view_builder_dashboard', 'Access Builder Dashboard Overview'],
                ['manage_builder_kyc', 'Review Builder KYC Documents'],
                ['manage_builder_agents', 'Manage Builder Sales Agents'],
                ['manage_builder_projects', 'Manage Builder Projects'],
                ['manage_builder_inventory', 'Manage Builder Inventory Units'],
                ['manage_builder_leads', 'Manage Builder CRM Leads'],
                ['manage_builder_visits', 'Manage Builder Visit Assignments'],
                ['manage_builder_portfolio', 'Manage Builder Portfolio Entries'],
                ['manage_builder_requirements', 'Manage Builder Requirements']
            ];

            for (const [name, desc] of defaultPerms) {
                await pool.query('INSERT INTO permissions (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING', [name, desc]);
            }

            // Auto-grant all to admin
            const allPerms = await pool.query('SELECT id FROM permissions');
            for (let row of allPerms.rows) {
                await pool.query('INSERT INTO role_permissions (role_name, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['admin', row.id]);
            }

            // Auto-grant moderation defaults to support. Runtime policy filters stale destructive grants.
            const supportPerms = ['view_overview', 'view_messages', 'view_users', 'manage_kyc'];
            for (let pName of supportPerms) {
                const pRes = await pool.query('SELECT id FROM permissions WHERE name = $1', [pName]);
                if (pRes.rows.length > 0) {
                    await pool.query('INSERT INTO role_permissions (role_name, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['support', pRes.rows[0].id]);
                }
            }

            const rolePermissionMap = {
                owner: ['view_overview', 'view_messages', 'manage_properties', 'manage_visits'],
                builder: [
                    'view_builder_dashboard',
                    'manage_builder_kyc',
                    'manage_builder_agents',
                    'manage_builder_projects',
                    'manage_builder_inventory',
                    'manage_builder_leads',
                    'manage_builder_visits',
                    'manage_builder_portfolio',
                    'manage_builder_requirements',
                    'manage_properties',
                    'view_messages',
                    'manage_visits',
                    'manage_sales'
                ],
                broker: ['view_overview', 'view_messages', 'manage_properties', 'manage_visits', 'manage_sales', 'manage_team'],
                external_sales: ['view_overview', 'view_messages', 'manage_properties', 'manage_visits', 'manage_sales', 'manage_corporate'],
                corporate: ['view_overview', 'view_messages', 'manage_properties', 'manage_visits', 'manage_corporate']
            };

            for (const [roleName, permissionNames] of Object.entries(rolePermissionMap)) {
                for (let pName of permissionNames) {
                    const pRes = await pool.query('SELECT id FROM permissions WHERE name = $1', [pName]);
                    if (pRes.rows.length > 0) {
                        await pool.query('INSERT INTO role_permissions (role_name, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleName, pRes.rows[0].id]);
                    }
                }
            }
        } catch (err) { console.error("Error auto-seeding permissions:", err); }

        // Ensure Properties table exists
        await pool.query(`CREATE TABLE IF NOT EXISTS properties (
            id SERIAL PRIMARY KEY,
            owner_id INTEGER REFERENCES users(id),
            title TEXT,
            status VARCHAR(20) DEFAULT 'listed',
            listing_type VARCHAR(20) DEFAULT 'rent',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS locality TEXT");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS final_price NUMERIC");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS photos TEXT[]");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS listing_type VARCHAR(20) DEFAULT 'rent'");

        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS size TEXT");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS condition TEXT");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS listed_at TIMESTAMP");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_matrix_verified BOOLEAN DEFAULT FALSE");
        
        // Modern Verification Workflow Additions
        await pool.query("ALTER TABLE properties ALTER COLUMN status SET DEFAULT 'listed'");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'Unverified'");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS verification_notes TEXT");
        
        // Migrate Legacy Data non-destructively
        await pool.query("UPDATE properties SET status = 'listed' WHERE status = 'pending'");
        await pool.query("UPDATE properties SET verification_status = 'Verified', verified_at = CURRENT_TIMESTAMP WHERE is_matrix_verified = TRUE AND verification_status = 'Unverified'");

        // Force any incoming 'pending' properties to 'listed' automatically
        await pool.query(`
            CREATE OR REPLACE FUNCTION force_property_listed()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.status = 'pending' THEN
                    NEW.status = 'listed';
                END IF;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        await pool.query(`DROP TRIGGER IF EXISTS trg_force_property_listed ON properties;`);
        await pool.query(`CREATE TRIGGER trg_force_property_listed BEFORE INSERT OR UPDATE OF status ON properties FOR EACH ROW EXECUTE FUNCTION force_property_listed();`);

        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS type TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS saved_filters TEXT");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS model_path TEXT");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_broker_id INTEGER REFERENCES users(id)");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS ownership_docs TEXT[]");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS ownership_declaration BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS assigned_brokers INTEGER[] DEFAULT '{}'");
        await pool.query("UPDATE properties SET assigned_brokers = ARRAY[assigned_broker_id] WHERE assigned_broker_id IS NOT NULL AND (assigned_brokers IS NULL OR array_length(assigned_brokers, 1) IS NULL)");
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
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_property_management_requests_unique_pending ON property_management_requests(property_id, agent_id) WHERE status = 'pending'`);
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
        
        // --- GIS & PostGIS Spatial Integration ---
        try {
            // Check if PostGIS is already enabled or can be enabled
            const postgisCheck = await pool.query("SELECT 1 FROM pg_extension WHERE extname = 'postgis'");
            let postgisInstalled = postgisCheck.rowCount > 0;
            
            if (!postgisInstalled) {
                try {
                    await pool.query("CREATE EXTENSION IF NOT EXISTS postgis;");
                    postgisInstalled = true;
                } catch (e) {
                    // If we can't create it, we'll fallback to Haversine in the app
                    pool.postgisEnabled = false;
                }
            }
            
            if (postgisInstalled) {
                pool.postgisEnabled = true;
                await pool.query("ALTER TABLE properties ADD COLUMN IF NOT EXISTS geom GEOMETRY(Point, 4326);");
                
                // Create trigger to automatically keep the Geometry column in sync with Lat/Lng
                await pool.query(`
                    CREATE OR REPLACE FUNCTION update_geom_column()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        IF NEW.longitude IS NOT NULL AND NEW.latitude IS NOT NULL THEN
                            NEW.geom = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
                        END IF;
                        RETURN NEW;
                    END;
                    $$ language 'plpgsql';
                `);
                await pool.query(`DROP TRIGGER IF EXISTS trg_update_geom ON properties;`);
                await pool.query(`CREATE TRIGGER trg_update_geom BEFORE INSERT OR UPDATE OF latitude, longitude ON properties FOR EACH ROW EXECUTE FUNCTION update_geom_column();`);
                
                // Backfill existing data and create Spatial Index
                await pool.query(`UPDATE properties SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) WHERE longitude IS NOT NULL AND latitude IS NOT NULL AND geom IS NULL;`);
                await pool.query(`CREATE INDEX IF NOT EXISTS properties_geom_idx ON properties USING GIST (geom);`);
            } else {
                pool.postgisEnabled = false;
            }
        } catch (e) { 
            pool.postgisEnabled = false;
        }
        
        // Dealer & Agent Support
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES users(id)");
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
            SET parent_type = parent.role
            FROM users parent
            WHERE child.role = 'external_sales'
              AND child.parent_id = parent.id
              AND (child.parent_type IS NULL OR child.parent_type = '')
        `);
        await pool.query("UPDATE users SET parent_type = NULL WHERE role = 'external_sales' AND parent_id IS NULL");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_name TEXT");
        
        // Fix: Drop constraint first to allow role update
        try {
            await pool.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
        } catch (e) { console.log("Role constraint drop error (safe):", e.message); }

        // Rename legacy roles to new terminology
        await pool.query("UPDATE users SET role = 'tenant' WHERE role = 'user' OR role = 'renter'");
        await pool.query("UPDATE users SET role = 'builder' WHERE role = 'dealer'");
        await pool.query("UPDATE users SET role = 'broker' WHERE role = 'agent'");

        try {
            await pool.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('tenant', 'owner', 'admin', 'support', 'builder', 'broker', 'corporate', 'corporate_user', 'external_sales'))");
        } catch (e) { console.log("Role constraint update error (safe if exists):", e.message); }
        await pool.query(`CREATE TABLE IF NOT EXISTS kyc_docs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            doc_type VARCHAR(50),
            file_path TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query("ALTER TABLE kyc_docs ADD COLUMN IF NOT EXISTS document_number TEXT");
        await pool.query("ALTER TABLE kyc_docs ADD COLUMN IF NOT EXISTS rejection_reason TEXT");
        await pool.query(`CREATE TABLE IF NOT EXISTS visits (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            scheduled_at TIMESTAMP NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        try {
            await pool.query("ALTER TABLE visits ALTER COLUMN scheduled_at DROP NOT NULL");
        } catch (e) { console.log("Could not drop NOT NULL on scheduled_at (safe):", e.message); }

        await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES users(id)");
        await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS notes TEXT");
        await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS preferred_date DATE");
        await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS preferred_time VARCHAR(50)");
        await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50)");
        await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS requester_message TEXT");
        await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS manager_notes TEXT");
        await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id)");
        
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS corporate_type TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_domain_approved BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_history TEXT DEFAULT '[]'");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_two_factor_enabled BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes TEXT DEFAULT '[]'");
        
        // Corporate Additions
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS rm_id INTEGER REFERENCES users(id)");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS company_logo TEXT");
        await pool.query(`CREATE TABLE IF NOT EXISTS corporate_requirements (
            id SERIAL PRIMARY KEY,
            corporate_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            cities TEXT,
            locality TEXT,
            property_type TEXT,
            min_size TEXT,
            budget TEXT,
            description TEXT,
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query("ALTER TABLE corporate_requirements ADD COLUMN IF NOT EXISTS locality TEXT");
        await pool.query("ALTER TABLE corporate_requirements ADD COLUMN IF NOT EXISTS description TEXT");

        // Agent Schedules
        await pool.query(`CREATE TABLE IF NOT EXISTS agent_schedules (
            id SERIAL PRIMARY KEY,
            agent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            scheduled_at TIMESTAMP NOT NULL,
            type VARCHAR(20) DEFAULT 'other',
            reference_id INTEGER,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Leads table for External Sales
        await pool.query(`CREATE TABLE IF NOT EXISTS leads (
            id SERIAL PRIMARY KEY,
            agent_id INTEGER REFERENCES users(id),
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            type VARCHAR(20),
            preferences TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Ensure other essential tables exist
        await pool.query(`CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            sender_username TEXT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Advanced Chat & Conversations System (OLX Style)
        await pool.query(`CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            tenant_username TEXT NOT NULL,
            last_message TEXT,
            last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            unread_count_tenant INTEGER DEFAULT 0,
            unread_count_owner INTEGER DEFAULT 0,
            deleted_by TEXT[] DEFAULT '{}',
            UNIQUE(property_id, tenant_username)
        )`);
        // New OLX‑style conversation table
        await pool.query(`CREATE TABLE IF NOT EXISTS property_conversations (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            last_message TEXT,
            last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            unread_count_buyer INTEGER DEFAULT 0,
            unread_count_owner INTEGER DEFAULT 0,
            deleted_by INTEGER[] DEFAULT '{}',
            UNIQUE(property_id, buyer_id, owner_id)
        )`);
        // Messages table linked to the new conversations
        await pool.query(`CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER REFERENCES property_conversations(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT FALSE,
            deleted_by INTEGER[] DEFAULT '{}'
        )`);
        // Indexes for fast lookup
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_propconv_user ON property_conversations (buyer_id, owner_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_chatmsg_conv ON chat_messages (conversation_id)`);
        await pool.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_by TEXT[] DEFAULT '{}'`);

        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE");
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by TEXT[] DEFAULT '{}'");
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE");

        // Backfill conversations for existing historical messages
        try {
            await pool.query(`
                INSERT INTO conversations (property_id, tenant_username, last_message, last_message_at)
                SELECT property_id, tenant_username, LAST_VALUE(content) OVER(PARTITION BY property_id, tenant_username ORDER BY created_at RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING), MAX(created_at) OVER(PARTITION BY property_id, tenant_username)
                FROM messages
                WHERE tenant_username IS NOT NULL AND conversation_id IS NULL
                ON CONFLICT (property_id, tenant_username) DO NOTHING
            `);
            await pool.query(`
                UPDATE messages m
                SET conversation_id = c.id
                FROM conversations c
                WHERE m.property_id = c.property_id AND m.tenant_username = c.tenant_username AND m.conversation_id IS NULL
            `);
        } catch (e) {}

        // Add visibility flag to segregate private chats from admin chats
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private'");
        await pool.query("ALTER TABLE messages ADD COLUMN IF NOT EXISTS tenant_username TEXT");

        // WhatsApp Message Logs
        await pool.query(`CREATE TABLE IF NOT EXISTS whatsapp_logs (
            id SERIAL PRIMARY KEY,
            phone VARCHAR(50),
            template_name VARCHAR(50),
            status VARCHAR(20),
            response JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS contact_messages (
            id SERIAL PRIMARY KEY,
            name TEXT,
            email TEXT,
            phone TEXT,
            topic TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query("ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS phone TEXT");
        await pool.query("ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS topic TEXT");
        await pool.query(`CREATE TABLE IF NOT EXISTS contact_inquiries (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            requester_email TEXT,
            manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            channel VARCHAR(30) DEFAULT 'contact_request',
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_inquiries_property_time ON contact_inquiries(property_id, created_at DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_contact_inquiries_requester_time ON contact_inquiries(requester_id, created_at DESC)`);

        await pool.query(`CREATE TABLE IF NOT EXISTS reports (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            reported_username TEXT,
            reason TEXT,
            description TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS activity_logs (
            id SERIAL PRIMARY KEY,
            admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(100) NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS reviews (
            id SERIAL PRIMARY KEY,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            content TEXT,
            link TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Drop type constraint to allow newly added property types like PG
        try {
            await pool.query("ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_type_check");
        } catch (e) { console.log("Property type constraint drop error (safe):", e.message); }

        await pool.query(`CREATE TABLE IF NOT EXISTS favorites (
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, property_id)
        )`);

        await pool.query(`CREATE TABLE IF NOT EXISTS partner_follows (
            follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            partner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (follower_id, partner_id)
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_partner_follows_partner_id ON partner_follows(partner_id)`);

        // Remove unique constraint on favorites as requested
        try {
            await pool.query("ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_id_property_id_key");
            await pool.query("DROP INDEX IF EXISTS favorites_user_id_property_id_key");
        } catch (e) { console.log("Constraint drop error (safe to ignore):", e.message); }

        // Recently Viewed Table
        await pool.query(`CREATE TABLE IF NOT EXISTS recently_viewed (
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, property_id)
        )`);

        // Vault Documents Table
        await pool.query(`CREATE TABLE IF NOT EXISTS vault_documents (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Vault Folders Table
        await pool.query(`CREATE TABLE IF NOT EXISTS vault_folders (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query("ALTER TABLE vault_documents ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES vault_folders(id) ON DELETE CASCADE");

        // Projects & Multi-Broker System
        try {
            // Migrate legacy dealer_id to builder_id
            await pool.query('ALTER TABLE IF EXISTS projects RENAME COLUMN dealer_id TO builder_id;');
        } catch(e) {}

        await pool.query(`CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            builder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            type VARCHAR(50),
            location TEXT,
            description TEXT,
            status VARCHAR(20) DEFAULT 'Upcoming',
            rera_id TEXT,
            photos TEXT[],
            documents TEXT[],
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Try adding new columns if projects table already existed from legacy ERP logic
        try {
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS type VARCHAR(50)");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Upcoming'");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS photos TEXT[]");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS documents TEXT[]");
            
            // Modern Builder CRM Enhancements
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_year INTEGER");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS amenities TEXT[]");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS possession_date DATE");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS floor_plans TEXT[]");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS pricing_details JSONB");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS highlights TEXT[]");
            await pool.query("ALTER TABLE projects ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'Unverified'");
        } catch(e) {}

        await pool.query(`CREATE TABLE IF NOT EXISTS project_brokers (
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            broker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (project_id, broker_id)
        )`);

        // Inventory Management
        await pool.query(`CREATE TABLE IF NOT EXISTS inventory_units (
            id SERIAL PRIMARY KEY,
            project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
            tower VARCHAR(50),
            floor VARCHAR(50),
            unit_number VARCHAR(50),
            area VARCHAR(50),
            type VARCHAR(50),
            price NUMERIC,
            visibility VARCHAR(20) DEFAULT 'Public',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query("ALTER TABLE inventory_units ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Available'");

        // --- Builder Portfolio ---
        await pool.query(`CREATE TABLE IF NOT EXISTS builder_portfolio (
            id SERIAL PRIMARY KEY,
            builder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(100) NOT NULL,
            location TEXT NOT NULL,
            completion_year INTEGER,
            amenities TEXT,
            description TEXT,
            photos JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Builder CRM Leads
        try {
            await pool.query('ALTER TABLE IF EXISTS dealer_leads RENAME TO builder_leads;');
            await pool.query('ALTER TABLE IF EXISTS builder_leads RENAME COLUMN dealer_id TO builder_id;');
        } catch(e) {}

        await pool.query(`CREATE TABLE IF NOT EXISTS builder_leads (
            id SERIAL PRIMARY KEY,
            builder_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
            name VARCHAR(100),
            phone VARCHAR(20),
            email VARCHAR(100),
            source VARCHAR(50) DEFAULT 'Direct',
            stage VARCHAR(50) DEFAULT 'Inquiry',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query("ALTER TABLE builder_leads ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL");
        await pool.query("ALTER TABLE builder_leads ADD COLUMN IF NOT EXISTS notes TEXT");
        await pool.query("ALTER TABLE builder_leads ADD COLUMN IF NOT EXISTS is_hot BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE builder_leads ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP");

        // Hot Requirements Enhancements
        await pool.query("ALTER TABLE corporate_requirements ADD COLUMN IF NOT EXISTS requirement_type VARCHAR(20) DEFAULT 'Buy'");
        await pool.query("ALTER TABLE corporate_requirements ADD COLUMN IF NOT EXISTS description TEXT");

        // --- Foreign Key Constraint Fixes for Hard Deletion ---
        const updateForeignKey = async (table, column, refTable, refColumn, action) => {
            try {
                const res = await pool.query(`
                    SELECT tc.constraint_name
                    FROM information_schema.table_constraints AS tc
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY' 
                      AND tc.table_name = $1 
                      AND kcu.column_name = $2;
                `, [table, column]);
                if (res.rows.length > 0) {
                    const constraintName = res.rows[0].constraint_name;
                    await pool.query(`ALTER TABLE ${table} DROP CONSTRAINT ${constraintName}`);
                    await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} FOREIGN KEY (${column}) REFERENCES ${refTable}(${refColumn}) ON DELETE ${action}`);
                }
            } catch (e) {}
        };
        await updateForeignKey('properties', 'owner_id', 'users', 'id', 'CASCADE');
        await updateForeignKey('properties', 'assigned_broker_id', 'users', 'id', 'SET NULL');
        await updateForeignKey('users', 'parent_id', 'users', 'id', 'CASCADE');
        await updateForeignKey('users', 'rm_id', 'users', 'id', 'SET NULL');
        await updateForeignKey('kyc_docs', 'user_id', 'users', 'id', 'CASCADE');
        await updateForeignKey('leads', 'agent_id', 'users', 'id', 'CASCADE');
        await updateForeignKey('projects', 'builder_id', 'users', 'id', 'CASCADE');
        await updateForeignKey('visits', 'agent_id', 'users', 'id', 'SET NULL');

        // Full-Text Search (FTS) Indexes for performance
        try {
            // We use the 'simple' dictionary (instead of 'english') to prevent aggressive stemming, which is better for names & localities
            await pool.query(`CREATE INDEX IF NOT EXISTS properties_fts_idx ON properties USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(locality, '') || ' ' || coalesce(type, '') || ' ' || coalesce(status, '') || ' ' || coalesce(listing_type, '')))`);
            await pool.query(`CREATE INDEX IF NOT EXISTS users_fts_idx ON users USING GIN (to_tsvector('simple', coalesce(username, '')))`);
        } catch (e) { console.log("FTS Index creation error:", e.message); }

        // B-Tree Indexes for Foreign Keys and Frequent Lookups to prevent full table scans
        try {
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_properties_assigned_broker_id ON properties(assigned_broker_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status)`);
            
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_property_id ON messages(property_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_messages_tenant_username ON messages(tenant_username)`);
            
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_visits_property_id ON visits(property_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_visits_user_id ON visits(user_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_visits_agent_id ON visits(agent_id)`);
            
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON notifications(user_id, is_read)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_agent_id ON leads(agent_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_sales_agent_type ON users(role, sales_agent_type)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_sales_parent ON users(parent_id, sales_agent_type)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_property_management_requests_agent ON property_management_requests(agent_id, status)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_property_management_requests_property ON property_management_requests(property_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned_to_status ON agent_tasks(assigned_to, status)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_by ON agent_tasks(created_by)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent_id ON agent_tasks(parent_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_sales_transactions_agent_status ON sales_transactions(agent_id, status)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_sales_transactions_property_id ON sales_transactions(property_id)`);
            
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_favorites_property_id ON favorites(property_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id_time ON recently_viewed(user_id, viewed_at DESC)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id_time ON notifications(user_id, created_at DESC)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_corporate_reqs_corp_id ON corporate_requirements(corporate_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_reviews_target_user_id ON user_reviews(target_user_id)`);
            
            // --- pg_trgm Extensions for Ultra-Fast Search Autocomplete ---
            try {
                await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
                await pool.query('CREATE INDEX IF NOT EXISTS properties_locality_trgm_idx ON properties USING GIN (locality gin_trgm_ops)');
                await pool.query('CREATE INDEX IF NOT EXISTS properties_title_trgm_idx ON properties USING GIN (title gin_trgm_ops)');
                await pool.query('CREATE INDEX IF NOT EXISTS users_username_trgm_idx ON users USING GIN (username gin_trgm_ops)');
                await pool.query('CREATE INDEX IF NOT EXISTS projects_name_trgm_idx ON projects USING GIN (name gin_trgm_ops)');
            } catch (e) { console.log("pg_trgm Extension/Index error (safe if not supported by host):", e.message); }
        } catch (e) { console.log("B-Tree Index creation error:", e.message); }

        // Setup session table for connect-pg-simple
        await pool.query(`CREATE TABLE IF NOT EXISTS "session" (
            "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
            "sess" json NOT NULL,
            "expire" timestamp(6) NOT NULL
        )`);
        await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);

            // --- NEW MESSAGING SYSTEM (OLX-Style) ---
            await pool.query(`CREATE TABLE IF NOT EXISTS property_conversations (
                id SERIAL PRIMARY KEY,
                property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
                buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                last_message TEXT,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                unread_count_owner INTEGER DEFAULT 0,
                unread_count_buyer INTEGER DEFAULT 0,
                deleted_by INTEGER[] DEFAULT '{}',
                bot_enabled BOOLEAN DEFAULT TRUE,
                UNIQUE(property_id, buyer_id, owner_id)
            )`);
            await pool.query("ALTER TABLE property_conversations ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT TRUE");

            // Migration: Convert deleted_by from TEXT[] to INTEGER[] if necessary
            try {
                await pool.query(`
                    DO $$ 
                    BEGIN 
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'property_conversations' AND column_name = 'deleted_by' AND udt_name = '_text') THEN
                            ALTER TABLE property_conversations ALTER COLUMN deleted_by DROP DEFAULT;
                            ALTER TABLE property_conversations ALTER COLUMN deleted_by TYPE INTEGER[] USING deleted_by::integer[];
                            ALTER TABLE property_conversations ALTER COLUMN deleted_by SET DEFAULT '{}';
                        END IF;
                        
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'deleted_by' AND udt_name = '_text') THEN
                            ALTER TABLE chat_messages ALTER COLUMN deleted_by DROP DEFAULT;
                            ALTER TABLE chat_messages ALTER COLUMN deleted_by TYPE INTEGER[] USING deleted_by::integer[];
                            ALTER TABLE chat_messages ALTER COLUMN deleted_by SET DEFAULT '{}';
                        END IF;
                    END $$;
                `);
            } catch (e) { console.log("Migration error (safe if already changed):", e.message); }

            await pool.query(`CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                conversation_id INTEGER REFERENCES property_conversations(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT,
                visibility VARCHAR(20) DEFAULT 'private',
                is_read BOOLEAN DEFAULT FALSE,
                deleted_by INTEGER[] DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Cleanup old indexes if they reference non-existent columns or renamed logic
            try {
                await pool.query(`CREATE INDEX IF NOT EXISTS idx_prop_conv_owner_id ON property_conversations(owner_id)`);
                await pool.query(`CREATE INDEX IF NOT EXISTS idx_prop_conv_buyer_id ON property_conversations(buyer_id)`);
                await pool.query(`CREATE INDEX IF NOT EXISTS idx_chat_msg_conv_id ON chat_messages(conversation_id)`);
            } catch (e) { console.log("New messaging indexes error (safe):", e.message); }

    } catch (e) { 
        console.log("Schema update error (safe to ignore if columns exist):", e.message); 
    }
};
