# MatrixSpaces Schema Governance

## Canonical source moving forward

MatrixSpaces should treat the `backend/migrations/` directory as the canonical schema change log.

Current production behavior still relies on `backend/db-init.js` because:

- `backend/migrations/001_initial_schema.js` delegates to `db-init.js`
- `backend/database.sql` is an outdated bootstrap snapshot
- `db-init.js` contains additive `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE`, index creation, and backfill logic

## Current duplication audit

The following schema definitions are duplicated today:

- `users`
  - Declared in `backend/database.sql`
  - Created and expanded in `backend/db-init.js`
- `properties`
  - Declared in `backend/database.sql`
  - Created and expanded in `backend/db-init.js`
- `property_conversations`
  - Created twice in `backend/db-init.js`
- `chat_messages`
  - Created twice in `backend/db-init.js`
- Indexes
  - Property conversation indexes are added in multiple places in `backend/db-init.js`
- Role constraints
  - Legacy role values remain visible in `backend/database.sql`
  - Current role normalization lives in `backend/db-init.js`

## Cleanup plan

1. Freeze `backend/database.sql` as a legacy reference only.
2. Keep `backend/db-init.js` as the compatibility bootstrap until every table/index/backfill is captured as explicit migrations.
3. Split `backend/db-init.js` into ordered migrations:
   - base tables
   - additive columns
   - data backfills
   - indexes and constraints
4. After migration parity is verified in a staging database:
   - stop adding new schema logic to `db-init.js`
   - point new environments at migrations only
5. After at least one full deployment cycle verifies parity:
   - retire legacy DDL from `backend/database.sql`
   - reduce `db-init.js` to compatibility checks or remove it

## Rules for future changes

- New schema changes should be added as new migration files, not as ad hoc `ALTER TABLE` statements inside route code.
- `backend/database.sql` should not be updated as an active schema source unless the team intentionally restores SQL-snapshot-based provisioning.
- Any new migration should note whether it replaces logic that still exists in `db-init.js`.
