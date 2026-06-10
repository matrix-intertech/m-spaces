# Admin Route Audit

Branch: `hardening-phase-4-admin-route-cleanup`

## Scope

This phase audited `backend/admin-routes.js` for duplicate route definitions and low-risk cleanup opportunities while preserving all admin workflows and permissions.

## Confirmed Findings

### Duplicate route removed

- Route: `POST /admin/referral/withdrawal/status`
- File: [admin-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/admin-routes.js)

#### Earlier duplicate behavior

- updated withdrawal status
- refunded wallet balance on rejection
- redirected to `/admin?tab=referrals`

#### Later duplicate behavior

- updated withdrawal status
- refunded wallet balance on rejection
- sent rejection notification
- sent approval notification
- redirected to `/admin?tab=referrals`

### Effective ownership decision

The later route definition was retained because it is behaviorally richer and is the route Express would effectively use only if the earlier duplicate were removed from the file. Keeping both definitions created ambiguity and maintenance risk.

## Cleanup Performed

- removed the earlier duplicate `POST /admin/referral/withdrawal/status`
- retained the later notification-aware implementation

## Backward Compatibility

- route URL unchanged
- request body unchanged
- redirect target unchanged
- permission gate unchanged
- referral workflow unchanged

## Remaining Admin Route Debt

- `backend/admin-routes.js` remains a large monolithic route file
- permission middleware is still partly local to the file
- admin, moderation, KYC, referrals, sales, corporate, export, and bot flows still live together

## Verification

- `node --check backend/admin-routes.js`
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`
- `npm.cmd run test` in `backend`

### Known test limitation

- backend test harness still reports `9 Passed, 9 Failed`
- failures remain the same demo-login credential issue and are not specific to this phase

## Recommended Next Step

Continue Phase 4 by extracting the next admin slice into controller/service/repository layers, starting with:

1. referrals
2. KYC moderation
3. exports
