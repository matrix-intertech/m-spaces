async function migratePropertyOwnershipClassification(pool) {
    await pool.query(`
        ALTER TABLE properties
        DROP CONSTRAINT IF EXISTS properties_ownership_type_check
    `);

    await pool.query(`
        ALTER TABLE properties
        ADD CONSTRAINT properties_ownership_type_check
        CHECK (
            ownership_type IN (
                'self_owned',
                'managed',
                'managed_for_owner',
                'broker_managed',
                'sales_managed',
                'builder_inventory'
            )
            OR ownership_type IS NULL
        )
    `);

    await pool.query(`
        UPDATE properties
        SET ownership_type = 'broker_managed'
        WHERE ownership_type = 'managed'
          AND (
              assigned_broker_id IN (SELECT id FROM users WHERE role = 'broker')
              OR EXISTS (
                  SELECT 1
                  FROM users u
                  WHERE u.role = 'broker'
                    AND u.id = ANY(COALESCE(properties.assigned_brokers, '{}'::int[]))
              )
          )
    `);

    await pool.query(`
        UPDATE properties
        SET ownership_type = 'sales_managed'
        WHERE ownership_type = 'managed'
          AND (
              assigned_broker_id IN (
                  SELECT id
                  FROM users
                  WHERE role = 'external_sales'
                     OR role = 'agent'
              )
              OR EXISTS (
                  SELECT 1
                  FROM users u
                  WHERE (u.role = 'external_sales' OR u.role = 'agent')
                    AND u.id = ANY(COALESCE(properties.assigned_brokers, '{}'::int[]))
              )
          )
    `);

    await pool.query(`
        UPDATE properties
        SET ownership_type = 'managed_for_owner'
        WHERE ownership_type = 'managed'
    `);
}

module.exports = migratePropertyOwnershipClassification;
