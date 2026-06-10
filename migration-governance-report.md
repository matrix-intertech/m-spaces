# Phase 2 Database Governance Report

## Scope

This phase continued the shift from implicit schema ownership toward explicit ordered migrations, while preserving all existing workflows and seed behavior.

## What Changed

### New explicit migration

- Added `backend/migrations/005_bot_responses_governance.js`
- `bot_responses` is now created by migrations instead of application bootstrap code

### Removed hidden schema mutation from runtime helpers

- `backend/bot-service.js`
  - `ensureSchema()` is now a backward-compatible schema verification helper
  - it no longer creates tables
  - `seedDefaults()` now verifies the table exists before seeding

### Reduced bootstrap bridge ownership

- `backend/db-init.js`
  - removed the direct `BotService.ensureSchema()` schema-creation path

### Redirected legacy one-off schema helpers

- `backend/create_visits_table.js`
  - now delegates to ordered migrations instead of creating `visits` directly
- `backend/bot.js`
  - now delegates to ordered migrations plus seed flow instead of creating `bot_responses` directly

## Current Governance State

### Explicit migrations now own

- `user_reviews`
- `partner_follows`
- `contact_inquiries`
- `property_assignments`
- `bot_responses`

### Still owned by the bootstrap bridge

- `001_initial_schema.js` still delegates to `db-init.js`
- `db-init.js` still owns the majority of core tables, constraints, indexes, extensions, triggers, and backfills

## Runtime DDL Status

### Removed in this phase

- `bot_responses` creation from bot runtime/bootstrap helpers

### Still present outside ordered migrations

- legacy schema bootstrap logic in `db-init.js`
- legacy setup path in `backend/setup_db.js`

## Backward Compatibility

- No route URLs changed
- No APIs changed
- No workflow logic changed
- Existing seed behavior was preserved
- Existing `BotService.ensureSchema()` callers remain valid, but now fail fast with a clear migration-required error instead of mutating schema silently

## Verification

- `node --check backend/bot-service.js`
- `node --check backend/db-init.js`
- `node --check backend/migrations/005_bot_responses_governance.js`
- `node backend/migrate-db.js`
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`
- `npm.cmd run test` in `backend`

## Known Remaining Gaps

1. `001_initial_schema.js` still depends on `db-init.js`
2. `db-init.js` still owns most schema objects
3. `setup_db.js` remains a legacy bootstrap path and should not be treated as canonical migration authority
