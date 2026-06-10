# MatrixSpaces Architecture Snapshot

Date: 2026-06-05
Branch: `production-hardening`

## Snapshot Purpose

This snapshot captures the production-hardening baseline before any new
hardening changes are applied on this branch. It reflects the current runtime
shape, not the target architecture.

## High-Level Shape

MatrixSpaces is a hybrid Next.js + Express platform.

```text
Browser
  -> Next.js App Router frontend
  -> Express backend routes and JSON APIs
  -> PostgreSQL via pg Pool
  -> S3 for media and KYC/vault uploads
  -> Redis/BullMQ for email queue when configured
  -> Socket.IO for chat and notifications
  -> Auth0 plus local/session auth
```

## Frontend

- App Router pages live in `frontend/app`.
- Shared UI lives in `frontend/components`.
- Server-side backend calls live in `frontend/services/api.ts`.
- Client-side calls use direct `fetch` in several components.
- Next rewrites `/api`, `/chat`, `/socket.io`, and `/uploads` to the backend.

## Backend

- Main Express app: `backend/server.js`.
- Route modules:
  - `auth-routes.js`
  - `public-routes.js`
  - `dashboard-routes.js`
  - `admin-routes.js`
  - `owner-routes.js`
  - `property-routes.js`
  - `builder-routes.js`
  - `chat-routes.js`
  - `chat-ui-routes.js`
  - `referral-routes.js`
- Session store: PostgreSQL `session` table via `connect-pg-simple`.
- Auth: local email/password, OTP, WhatsApp OTP, Auth0, 2FA.
- Uploads: Multer, multer-s3, local KYC/vault fallback.

## Database

Schema is currently created and evolved mostly at runtime through `db-init.js`, with additional migration files in `backend/migrations`.

Primary domains:
- Users and roles
- Properties and ownership/assignment
- Visits
- Leads
- Builder projects and inventory
- Chat conversations and messages
- Notifications
- Referrals and withdrawals
- Vault documents
- Corporate requirements
- Permissions

## Primary Risk Areas

- Runtime schema mutation instead of fully ordered migrations.
- Large route files combining multiple responsibilities.
- Scattered role and ownership checks.
- Hybrid Next/EJS route behavior.
- Direct backend forms from the Next frontend.

## Immediate Hardening Focus

- Eliminate confirmed cross-tenant data exposure in broker and builder payloads.
- Separate `support` from full administrative property powers.
- Separate `tenant` from `owner` workflow access without breaking existing
  user journeys.
- Enforce CSRF on all mutating routes.
- Replace request-derived auth URLs with environment-configured origins.
- Tighten CSP without breaking the frontend runtime.
