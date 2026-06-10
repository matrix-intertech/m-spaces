# MatrixSpaces Dependency Map

Date: 2026-06-05
Branch: `production-hardening`

## Purpose

This map captures the high-coupling areas that must be preserved while the
platform is hardened incrementally.

## Core Runtime Dependencies

### Frontend

- `frontend/app`
  - Next.js App Router pages and layouts.
- `frontend/components`
  - Shared UI for dashboards, property pages, maps, chat, forms, and home
    discovery.
- `frontend/services/api.ts`
  - Server-side fetch wrapper for Express APIs.
- `frontend/hooks/useSocket.ts`
  - Socket.IO client bootstrap for realtime chat/notifications.
- `frontend/lib/config.ts`
  - Frontend runtime URL configuration.

### Backend

- `backend/server.js`
  - Express app bootstrap, security middleware, sessions, CORS, uploads,
    Auth0, and route mounting.
- Route modules
  - `auth-routes.js`
  - `public-routes.js`
  - `dashboard-routes.js`
  - `admin-routes.js`
  - `owner-routes.js`
  - `builder-routes.js`
  - `property-routes.js`
  - `chat-routes.js`
  - `chat-ui-routes.js`
  - `referral-routes.js`
- Shared services and helpers
  - `db.js`
  - `permission-utils.js`
  - `authorization-service.js`
  - `property-access.js`
  - `profile-utils.js`
  - `sales-agent-utils.js`
  - `sales-workflow-utils.js`
  - `csrf-protection.js`
  - `inquiry-service.js`
  - `email-queue.js`
  - `redis-cache.js`
  - `sockets.js`

### Database and Schema

- `backend/migrate-db.js`
  - Ordered migration runner.
- `backend/migrations/*.js`
  - Migration inventory.
- `backend/db-init.js`
  - Current schema authority bridge still used by migration flow.

## Domain Dependency Map

### Authentication

- Depends on:
  - `server.js`
  - `auth-routes.js`
  - `users` table
  - `session` table
  - Auth0 env vars
  - OTP and email delivery
- Coupled to:
  - role normalization
  - dashboard routing
  - password reset and verification flows

### Authorization

- Depends on:
  - `permission-utils.js`
  - `authorization-service.js`
  - `property-access.js`
  - route-local role checks
- Coupled to:
  - users role model
  - property ownership and assignments
  - dashboard payload scoping

### Properties

- Depends on:
  - `property-routes.js`
  - `owner-routes.js`
  - `dashboard-routes.js`
  - `public-routes.js`
  - `properties` table
- Coupled to:
  - owner role
  - broker assignment
  - sales agent relationships
  - visits, leads, chat, notifications, favorites, recent views

### Builders and Projects

- Depends on:
  - `builder-routes.js`
  - `dashboard-routes.js`
  - `projects`, `inventory_units`, `builder_portfolio`, `builder_leads`
- Coupled to:
  - users parent/child structure
  - visits, leads, brokers, inventory, tasks, transactions

### Brokers and Sales Agents

- Depends on:
  - `dashboard-routes.js`
  - `sales-agent-utils.js`
  - `sales-workflow-utils.js`
  - `users.parent_id`, `users.sales_agent_type`
- Coupled to:
  - assigned properties
  - visits
  - leads
  - owner management requests

### Chat and Notifications

- Depends on:
  - `chat-routes.js`
  - `chat-ui-routes.js`
  - `sockets.js`
  - `property-access.js`
  - `notifications`, `messages`, `conversations`,
    `property_conversations`, `chat_messages`
- Coupled to:
  - property access control
  - inquiry/contact workflows

### Search and Discovery

- Depends on:
  - `public-routes.js`
  - `frontend/app/search`
  - `PropertyMap.tsx`
  - `redis-cache.js`
- Coupled to:
  - properties query design
  - indexes in `db-init.js`
  - image delivery
  - places APIs

## High-Risk Change Boundaries

- Role normalization:
  - changes here ripple into auth, owner dashboard, and permissions.
- Property assignment fields:
  - changes here affect dashboards, owner flows, chat access, and visits.
- Chat schema:
  - both legacy and current models still exist.
- Dashboard payloads:
  - large, cross-domain responses make scoping fixes sensitive.
- Request/response contracts:
  - Next frontend mixes server fetches and direct form posts, so compatibility
    must be preserved carefully.
