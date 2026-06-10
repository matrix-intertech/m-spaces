## Phase 4 Admin Route Cleanup Dependency Map

### Objective
Reduce admin-route duplication and route bloat without changing admin workflows, permissions, response shapes, exports, dashboards, or moderation behavior.

### Primary File In Scope
- `backend/admin-routes.js`

### Closely Coupled Dependencies
- `backend/permission-utils.js`
- `backend/policies/admin-policy.js`
- `backend/policies/support-policy.js`
- `backend/notification-service.js`
- `backend/bot-service.js`
- `backend/db.js`
- `backend/services/authorization/index.js`

### High-Sensitivity Admin Areas
- user management
- permission management
- referral withdrawals
- KYC review
- property moderation
- bot response management
- dashboard summary payloads
- export/report routes

### Known Confirmed Cleanup Target
- duplicate `/referral/withdrawal/status` route definitions in `backend/admin-routes.js`

### Phase 4 Verification Targets
- admin route inventory remains stable
- duplicate route definitions removed without changing effective behavior
- support/admin access boundaries remain unchanged from Phase 1
- frontend typecheck/build remain green
- backend syntax remains valid
