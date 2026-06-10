-- Legacy bootstrap snapshot only.
-- Active schema evolution currently flows through backend/migrations/ and
-- backend/db-init.js. See backend/docs/schema-governance.md before editing.

CREATE DATABASE matrixspaces;

\c matrixspaces;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('owner', 'renter', 'admin')) NOT NULL
);

CREATE TABLE properties (
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

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id),
    sender_username VARCHAR(50),
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id),
    user_id INTEGER REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    property_id INTEGER REFERENCES properties(id)
);
