require('dotenv').config();
const { Client } = require('pg');

const hasDatabaseUrl = !!process.env.DATABASE_URL;

const config = {
    ...(hasDatabaseUrl
        ? {
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
        }
        : {
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
        }),
};

async function setup() {
    console.log('Starting database setup...');
    
    // 1. Connect to default 'postgres' database to create 'matrixspaces' if needed
    if (hasDatabaseUrl) {
        console.log('DATABASE_URL is set. Skipping database creation step.');
    } else {
    const client1 = new Client({ ...config, database: 'postgres' });
    try {
        await client1.connect();
        const res = await client1.query("SELECT 1 FROM pg_database WHERE datname = 'matrixspaces'");
        if (res.rowCount === 0) {
            await client1.query('CREATE DATABASE matrixspaces');
            console.log('Database "matrixspaces" created.');
        } else {
            console.log('Database "matrixspaces" already exists.');
        }
    } catch (err) {
        console.error('Error checking/creating database:', err);
    } finally {
        await client1.end();
    }
    }

    // 2. Connect to 'matrixspaces' to create tables
    const client2 = hasDatabaseUrl
        ? new Client(config)
        : new Client({ ...config, database: 'matrixspaces' });
    try {
        await client2.connect();
        
        const queries = `
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100),
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) CHECK (role IN ('owner', 'renter', 'admin')) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                has_random_password BOOLEAN DEFAULT FALSE,
                referral_code VARCHAR(20) UNIQUE,
                referred_by VARCHAR(20),
                wallet_balance DECIMAL(12, 2) DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS referrals (
                id SERIAL PRIMARY KEY,
                referrer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                referred_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                amount DECIMAL(12, 2) DEFAULT 50,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS properties (
                id SERIAL PRIMARY KEY,
                owner_id INTEGER REFERENCES users(id),
                title VARCHAR(100),
                locality VARCHAR(100),
                contact VARCHAR(20),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                status VARCHAR(20) DEFAULT 'pending',
                estimated_min DECIMAL(12, 2) DEFAULT 0,
                estimated_max DECIMAL(12, 2) DEFAULT 0,
                final_price DECIMAL(12, 2) DEFAULT 0,
                infra_plan TEXT,
                photos TEXT[],
                is_booked BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                property_id INTEGER REFERENCES properties(id),
                sender_username VARCHAR(50),
                content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                property_id INTEGER REFERENCES properties(id),
                user_id INTEGER REFERENCES users(id),
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO users (username, email, password_hash, role) 
            VALUES ('admin', 'admin@matrixspaces.com', '$2b$10$X7...', 'admin')
            ON CONFLICT (username) DO NOTHING;

        `;

        await client2.query(queries);
        console.log('Tables created successfully.');
    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        await client2.end();
    }
}

setup();
