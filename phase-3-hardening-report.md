# MatrixSpaces Phase 3 Hardening Report

Date: 2026-06-05
Branch: `production-hardening`
Phase: `Phase 3 - Database Governance`

## Objective

Reduce schema drift by moving request-time DDL responsibilities into migrations,
add an additive property assignment table, and preserve backward compatibility
with the existing property assignment columns and workflows.

## Completed In This Pass

### 1. Migration Runner Compatibility

Updated [migrate-db.js](/c:/Users/Shikhar/Matrixspaces/backend/migrate-db.js):
- migrations now receive the shared `pool` when invoked

Impact:
- existing migration files that expect a `pool` argument now run correctly

### 2. Migration Inventory

Added:
- [migration-inventory.md](/c:/Users/Shikhar/Matrixspaces/migration-inventory.md)

This documents:
- the current migration chain
- the `db-init.js` bridge role
- the new Phase 3 governance migration

### 3. New Governance Migration

Added:
- [004_phase3_schema_governance.js](/c:/Users/Shikhar/Matrixspaces/backend/migrations/004_phase3_schema_governance.js)

This migration creates:
- `user_reviews`
- `partner_follows`
- `contact_inquiries`
- `property_assignments`

It also:
- adds indexes for these tables
- backfills active `property_assignments` from legacy property columns

### 4. Request-Time DDL Removal

Removed request-time table creation from:
- [owner-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/owner-routes.js)
  - `user_reviews`
- [public-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/public-routes.js)
  - `partner_follows`
- [inquiry-service.js](/c:/Users/Shikhar/Matrixspaces/backend/inquiry-service.js)
  - `contact_inquiries`
- [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js)
  - removed runtime `ALTER TABLE users ADD COLUMN IF NOT EXISTS name_last_changed`

Impact:
- these workflows no longer mutate schema during request handling

### 5. Additive Property Assignment Compatibility Layer

Added:
- [property-assignment-service.js](/c:/Users/Shikhar/Matrixspaces/backend/property-assignment-service.js)

Behavior:
- reads legacy `assigned_broker_id` and `assigned_brokers`
- writes synchronized active rows to `property_assignments`
- classifies assignment rows as:
  - `owner`
  - `builder`
  - `broker`
  - `associated_sales_agent`
  - `independent_sales_agent`

### 6. Compatibility Dual-Writes

Updated assignment flows to sync the new table after legacy writes:

- [owner-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/owner-routes.js)
  - assign broker
  - remove broker
  - remove all brokers

- [property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js)
  - on-behalf listing assignment path

- [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js)
  - broker assigns property to agent
  - independent sales management request accepted
  - owner assign-broker shortcut

Impact:
- legacy reads continue working
- new normalized assignment data now stays aligned with existing flows

## Verification

Passed syntax/type checks:
- `node --check backend/migrate-db.js`
- `node --check backend/migrations/004_phase3_schema_governance.js`
- `node --check backend/property-assignment-service.js`
- `node --check backend/public-routes.js`
- `node --check backend/inquiry-service.js`
- `node --check backend/owner-routes.js`
- `node --check backend/property-routes.js`
- `node --check backend/dashboard-routes.js`
- `npm.cmd run typecheck` in `frontend`

Migration run:
- `node migrate-db.js` from `backend` directory -> passed

Operational note:
- running migrations from repo root failed because [db.js](/c:/Users/Shikhar/Matrixspaces/backend/db.js) loads `.env` from the current working directory
- running from `backend` matched the working environment used by backend startup and succeeded

## What Improved

- production schema is less dependent on live request paths
- additive normalized assignment data now exists
- legacy assignment columns remain intact for backward compatibility
- migration chain is more trustworthy and documented

## Remaining Database Governance Work

- `db-init.js` is still a bridge and still owns too much schema
- many existing tables/columns are still created by the bootstrap bridge rather than explicit ordered migrations
- consumers still read assignment state from legacy property columns rather than from `property_assignments`

## Recommended Next Step

Proceed to Phase 4:
- route monolith reduction
- extract controller/service/repository structure
- start moving assignment reads toward `property_assignments` behind compatibility helpers
