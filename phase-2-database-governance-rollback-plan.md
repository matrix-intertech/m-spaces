## Phase 2 Database Governance Rollback Plan

### Rollback Scope
This phase may change migration files, schema bootstrap code, and documentation about schema ownership. It must not remove existing tables, alter business data, or break startup.

### Files In Scope
- `backend/db-init.js`
- `backend/migrate-db.js`
- `backend/migrations/*`
- schema governance reports and inventories
- any helper script whose DDL behavior is migrated or disabled

### Rollback Strategy
Use targeted file reverts for only the Phase 2 files. Do not revert unrelated hardening work from prior phases.

If a new migration causes a bootstrap issue:
- restore the previous migration file set
- restore the previous `db-init.js` bridge behavior
- rerun syntax checks and migration dry verification from `backend`

### Operational Safety
- do not delete or rewrite existing data during this phase
- prefer additive migration ownership moves
- preserve compatibility for current tables and columns
- keep `property_assignments` and legacy assignment fields interoperable

### Validation After Rollback
- `node --check` on touched backend files
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`
- `node migrate-db.js` from `backend` if migration files changed

### Trigger Conditions For Rollback
- backend startup failure from missing relation/column/index
- migration ordering failure
- live route failure caused by missing schema object
- loss of compatibility with existing tables or legacy reads
