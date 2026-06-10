# MatrixSpaces Role Boundary Test Notes

Date: 2026-06-05
Branch: `production-hardening`
Phase: `Phase 1`

## Completed Verification

### Broker

Validated in [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js):
- dashboard property pickers are scoped to broker-managed properties
- dashboard user pickers are scoped to broker-related users from visits/conversations
- active property payload is scoped to broker-managed properties

### Builder

Validated in [builder-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/builder-routes.js):
- unassigned visits are scoped to builder-managed properties

### Support

Validated in:
- [authorization-service.js](/c:/Users/Shikhar/Matrixspaces/backend/authorization-service.js)
- [property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js)

Checks:
- support is not treated as property admin
- support can still participate in moderation-oriented access paths via
  [property-access.js](/c:/Users/Shikhar/Matrixspaces/backend/property-access.js)

### Owner vs Tenant

Validated in:
- [profile-utils.js](/c:/Users/Shikhar/Matrixspaces/backend/profile-utils.js)
- [owner-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/owner-routes.js)
- [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js)

Checks:
- tenant no longer normalizes to owner
- owner-only routes require owner role
- owner assignment shortcut rejects tenant role

### CSRF

Validated in:
- [server.js](/c:/Users/Shikhar/Matrixspaces/backend/server.js)
- [csrf-protection.js](/c:/Users/Shikhar/Matrixspaces/backend/csrf-protection.js)
- [csrf-guard.js](/c:/Users/Shikhar/Matrixspaces/frontend/public/js/csrf-guard.js)

Checks:
- token route remains available
- mutating routes now flow through global CSRF middleware
- browser forms and same-origin fetch calls receive token injection support
- Auth0 callback path remains exempt

## Automated Checks Run

- `node --check backend/server.js`
- `node --check backend/auth-routes.js`
- `node --check backend/dashboard-routes.js`
- `node --check backend/builder-routes.js`
- `node --check backend/owner-routes.js`
- `node --check backend/property-routes.js`
- `node --check backend/profile-utils.js`
- `node --check backend/authorization-service.js`
- `npm.cmd run typecheck`
- `npm.cmd run build`

## Still Needed

- Full route-level authorization regression suite
- CSRF integration tests for login, owner dashboard, broker dashboard, builder dashboard, chat, and admin actions
- Support/admin permission regression coverage
- Tenant/owner regression coverage for legacy accounts
