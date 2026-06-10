# MatrixSpaces Security Report

Date: 2026-06-05
Branch: `production-hardening`
Phase: `Phase 1 - P0 Security & Data Isolation`

## Scope Completed In This Pass

- Broker dashboard cross-tenant payload scoping
- Builder unassigned-visit payload scoping
- Support removal from property-admin access paths
- Tenant removal from owner-only workflow entry points
- Auth email URL hardening using configured origins
- Global CSRF enforcement foundation with browser compatibility guard
- CSP tightening by removing `unsafe-eval`

## Implemented Changes

### 1. Broker Dashboard Payload Scoping

Updated [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js) so:
- `allProperties` only includes broker-managed properties
- `allTenants` only includes users connected through broker-scoped visits or conversations
- `activeProperties` only includes broker-managed properties

Impact:
- Removes confirmed cross-tenant exposure from broker dashboard JSON and rendered payloads.

### 2. Builder Unassigned Visit Scoping

Updated [builder-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/builder-routes.js) so unassigned visits are restricted to properties managed by the builder.

Impact:
- Removes confirmed global unassigned-visit leakage from the builder dashboard.

### 3. Support/Admin Separation For Property Control

Updated:
- [authorization-service.js](/c:/Users/Shikhar/Matrixspaces/backend/authorization-service.js)
- [property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js)

Changes:
- `admin` remains full property admin
- `support` no longer inherits property management/delete powers through `isAdminLike`
- `support` still remains available for moderation-oriented flows through
  [property-access.js](/c:/Users/Shikhar/Matrixspaces/backend/property-access.js)

Impact:
- Closes the confirmed support/admin privilege overlap on property mutation paths without removing support moderation behavior.

### 4. Tenant/Owner Separation

Updated:
- [profile-utils.js](/c:/Users/Shikhar/Matrixspaces/backend/profile-utils.js)
- [owner-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/owner-routes.js)
- [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js)
- [authorization-service.js](/c:/Users/Shikhar/Matrixspaces/backend/authorization-service.js)
- [auth-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/auth-routes.js)

Changes:
- Tenant role is no longer normalized into owner
- Owner-only routes now require owner role explicitly
- Owner assignment shortcut no longer accepts tenant role
- WhatsApp signup keeps `tenant` as `tenant`

Impact:
- Removes the confirmed owner/tenant role boundary leak on owner-only workflows.

### 5. Request-Derived Auth URL Removal

Updated [auth-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/auth-routes.js) to build verification and password-reset URLs from configured origins instead of `req.headers.host`.

Origin precedence:
- `PUBLIC_APP_ORIGIN`
- `FRONTEND_ORIGIN`
- `NEXT_PUBLIC_FRONTEND_URL`
- `AUTH0_BASE_URL`
- request origin fallback for local development only

Impact:
- Reduces host-header and wrong-origin link risks in auth emails.

### 6. Global CSRF Enforcement Foundation

Updated [server.js](/c:/Users/Shikhar/Matrixspaces/backend/server.js) and added
[csrf-guard.js](/c:/Users/Shikhar/Matrixspaces/frontend/public/js/csrf-guard.js).

Changes:
- global `requireCsrf` middleware for mutating routes
- token issuance via `/api/csrf-token`
- automatic HTML injection of `csrf-guard.js`
- client-side form token injection
- same-origin `fetch` token header injection
- Auth0 callback exemption preserved

Impact:
- Expands CSRF protection from route-local coverage to a platform-level default while keeping existing forms and fetches compatible.

### 7. CSP Tightening

Updated [server.js](/c:/Users/Shikhar/Matrixspaces/backend/server.js) to remove `unsafe-eval` from `scriptSrc`.

Impact:
- Reduces script execution flexibility and XSS blast radius without changing visible UI behavior.

## Verification Completed

Passed:
- `node --check backend/server.js`
- `node --check backend/auth-routes.js`
- `node --check backend/dashboard-routes.js`
- `node --check backend/builder-routes.js`
- `node --check backend/owner-routes.js`
- `node --check backend/property-routes.js`
- `node --check backend/profile-utils.js`
- `node --check backend/authorization-service.js`
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`

## Remaining Security Work Carried Forward

- Route-by-route authorization unification still remains for Phase 2.
- Support still has permission-driven access in admin areas; this pass only removed property-admin overlap.
- CSP still contains `unsafe-inline`; removing that safely needs a broader rendering/script inventory.
- Full role-boundary regression tests still need implementation.
