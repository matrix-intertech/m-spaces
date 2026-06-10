## Phase 4 Admin Route Cleanup Continuation

Branch: `hardening-phase-4-admin-route-cleanup`

### Scope

Extract the admin referral workflow from `backend/admin-routes.js` into controller, service, and repository layers without changing routes, permissions, redirects, or response behavior.

### Extracted Files

- `backend/controllers/admin-referral-controller.js`
- `backend/services/admin-referral-service.js`
- `backend/repositories/admin-referral-repository.js`

### Routes Delegated To Controller Layer

- `POST /admin/referral/pay`
- `POST /admin/referral/withdrawal/status`
- `GET /admin/export/pending-withdrawals`

### Preserved Behavior

- same route URLs
- same `hasPermission('manage_referrals')` guard
- same redirect target: `/admin?tab=referrals`
- same CSV export filename: `pending-withdrawals.csv`
- same wallet refund behavior on rejected withdrawals
- same withdrawal approval and rejection notification behavior

### Notes

- The duplicate `POST /admin/referral/withdrawal/status` route had already been removed earlier in Phase 4.
- The remaining inline handlers in `backend/admin-routes.js` now delegate immediately to the extracted controller methods. This keeps behavior centralized while avoiding a larger risky edit in the existing monolith.

### Verification

Planned verification for this continuation:

- `node --check backend/controllers/admin-referral-controller.js`
- `node --check backend/services/admin-referral-service.js`
- `node --check backend/repositories/admin-referral-repository.js`
- `node --check backend/admin-routes.js`
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`
- `npm.cmd run test` in `backend`

### Known Limitation

The backend live test harness still depends on seeded demo logins and a separately running server. Authenticated role checks are expected to keep failing until that harness is replaced or the seed path is stabilized.
