## Phase 2 Database Governance Dependency Map

### Objective
Make migrations the single source of truth for schema ownership while preserving current workflows, APIs, and database compatibility.

### Primary Schema Sources
- `backend/db-init.js`
- `backend/migrate-db.js`
- `backend/migrations/001_initial_schema.js`
- `backend/migrations/002_dual_sales_agents.js`
- `backend/migrations/003_sales_tasks_transactions.js`
- `backend/migrations/004_phase3_schema_governance.js`

### Supporting Schema / Bootstrap Scripts
- `backend/setup_db.js`
- `backend/add_avatar_url_column.js`
- `backend/add_phone_column.js`
- `backend/create_notifications_table.js`
- `backend/create_visits_table.js`
- `backend/fix_roles.js`
- `backend/bot-service.js`
- `backend/bot.js`

### Runtime Database Consumers Most Sensitive To Drift
- `backend/property-routes.js`
- `backend/dashboard-routes.js`
- `backend/admin-routes.js`
- `backend/owner-routes.js`
- `backend/chat-routes.js`
- `backend/sockets.js`
- `backend/inquiry-service.js`
- `backend/property-assignment-service.js`

### Schema Areas Most Coupled To Runtime Logic
- users / role permissions
- properties / assigned_broker_id / assigned_brokers
- property_assignments
- visits
- leads
- property_management_requests
- agent_tasks
- sales_transactions
- property_conversations / chat_messages
- messages / conversations
- contact_inquiries
- partner_follows
- user_reviews
- corporate_requirements
- vault_documents
- projects / project_brokers / inventory_units / builder_portfolio

### Governance Risks
- `001_initial_schema.js` still delegates to `db-init.js`
- `db-init.js` owns a large amount of DDL, indexes, constraints, backfills, and compatibility mutations
- helper scripts still contain standalone DDL paths
- request/runtime table creation may still exist in bot-related code
- schema drift can occur if environments are initialized by different entrypoints

### Verification Targets
- no request-time DDL in live workflows
- all active schema objects inventoried
- additive migration path for remaining `db-init.js` ownership
- migration runner remains deterministic and idempotent
- no user-facing route or API behavior changes
