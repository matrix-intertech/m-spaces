async function migratePropertyOwnershipType(pool) {
    await pool.query(`
        ALTER TABLE properties
        ADD COLUMN IF NOT EXISTS ownership_type VARCHAR(20)
    `);

    await pool.query(`
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'properties_ownership_type_check'
            ) THEN
                ALTER TABLE properties
                ADD CONSTRAINT properties_ownership_type_check
                CHECK (ownership_type IN ('self_owned', 'managed') OR ownership_type IS NULL);
            END IF;
        END $$;
    `);

    await pool.query(`
        UPDATE properties p
        SET ownership_type = 'self_owned'
        FROM users u
        WHERE p.ownership_type IS NULL
          AND p.owner_id = u.id
          AND (
              p.owner_id = p.assigned_broker_id
              OR (
                  u.role IN ('owner', 'tenant')
                  AND p.assigned_broker_id IS NULL
                  AND COALESCE(array_length(p.assigned_brokers, 1), 0) = 0
              )
          )
    `);

    await pool.query(`
        UPDATE properties
        SET ownership_type = 'managed'
        WHERE ownership_type IS NULL
          AND (
              assigned_broker_id IS NOT NULL
              OR COALESCE(array_length(assigned_brokers, 1), 0) > 0
          )
    `);
}

module.exports = migratePropertyOwnershipType;
