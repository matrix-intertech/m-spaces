# MatrixSpaces Migration Inventory

Date: 2026-06-05
Branch: `hardening-phase-2-database-governance`

## Migration Chain

1. `001_initial_schema.js`
   - Current bridge migration
   - Delegates to `db-init.js`

2. `002_dual_sales_agents.js`
   - Adds `sales_agent_type`, `parent_type`
   - Creates `property_management_requests`

3. `003_sales_tasks_transactions.js`
   - Adds task and transaction support
   - Adds related constraints and indexes

4. `004_phase3_schema_governance.js`
   - Creates `user_reviews` in migrations
   - Creates `partner_follows` in migrations
   - Creates `contact_inquiries` in migrations
   - Creates additive `property_assignments`
   - Backfills active property assignments from legacy property columns

5. `005_bot_responses_governance.js`
   - Creates `bot_responses` in migrations
   - Removes bot table ownership from runtime helpers

## Governance Notes

- `db-init.js` remains a bridge and still contains broad schema ownership.
- Phase 3 reduces request-time DDL and introduces additive migration-owned tables.
- Phase 2 additionally moves `bot_responses` table ownership into explicit migrations.
- Bot schema verification remains backward-compatible, but no longer mutates schema at runtime.
- Legacy helper scripts `backend/create_visits_table.js` and `backend/bot.js` now delegate to the canonical migration and seed flow instead of owning schema directly.
- Full decomposition of `db-init.js` into ordered migrations remains a later step.
