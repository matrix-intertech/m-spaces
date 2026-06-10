# MatrixSpaces Database Schema Snapshot

Date: 2026-06-05
Branch: `production-hardening`

## Schema Source

Primary schema source is `backend/db-init.js`, supplemented by:
- `backend/migrations/001_initial_schema.js`
- `backend/migrations/002_dual_sales_agents.js`
- `backend/migrations/003_sales_tasks_transactions.js`

## Core Tables Observed

- `users`
- `referrals`
- `withdrawals`
- `permissions`
- `role_permissions`
- `user_permissions`
- `properties`
- `property_management_requests`
- `agent_tasks`
- `sales_transactions`
- `kyc_docs`
- `visits`
- `corporate_requirements`
- `agent_schedules`
- `leads`
- `messages`
- `conversations`
- `property_conversations`
- `chat_messages`
- `whatsapp_logs`
- `contact_messages`
- `reports`
- `activity_logs`
- `reviews`
- `notifications`
- `favorites`
- `partner_follows`
- `recently_viewed`
- `vault_documents`
- `vault_folders`
- `projects`
- `project_brokers`
- `inventory_units`
- `builder_portfolio`
- `builder_leads`
- `session`

## Key Relationship Fields

- `properties.owner_id`
- `properties.assigned_broker_id`
- `properties.assigned_brokers`
- `users.parent_id`
- `users.sales_agent_type`
- `users.parent_type`
- `property_management_requests.property_id`
- `property_management_requests.owner_id`
- `property_management_requests.agent_id`
- `visits.property_id`
- `visits.user_id`
- `visits.agent_id`
- `leads.agent_id`
- `projects.builder_id`
- `project_brokers.project_id`
- `project_brokers.broker_id`
- `inventory_units.project_id`

## Existing Index Themes

- Properties owner/status/assigned broker.
- FTS/trigram attempts for properties/users/projects.
- Visits property/user/agent.
- Notifications user/read/time.
- Leads agent.
- Sales-agent parent/type.
- Agent tasks.
- Sales transactions.
- Favorites/recently viewed.
- Sessions expire.
- Chat conversation/message lookup.

## Governance Risks

- Schema authority is split between migrations, `db-init.js`, and request-time
  table creation helpers.
- Property assignment remains denormalized.
- Legacy and current chat schemas both remain active.

## Normalization Target

Add `property_assignments` in a later phase as a compatibility table while keeping legacy fields until all reads/writes are safely migrated.
