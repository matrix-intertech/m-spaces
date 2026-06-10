## Phase 4 Admin Route Cleanup Rollback Plan

### Rollback Scope
This phase focuses on admin-route audit and low-risk duplication cleanup. Rollback must preserve all admin URLs, redirects, exports, permission checks, and response behavior.

### Files In Scope
- `backend/admin-routes.js`
- Phase 4 admin-route reports and inventories

### Rollback Strategy
- revert only Phase 4 admin-route cleanup changes
- preserve existing route order where behavior depends on first-match semantics
- if a duplicate-removal changes behavior unexpectedly, restore the removed definition and re-audit route precedence

### Operational Safety
- no admin feature removal
- no permission broadening
- no payload contract changes
- no workflow changes for referrals, KYC, properties, or users

### Validation After Rollback
- `node --check backend/admin-routes.js`
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`
- `npm.cmd run test` in `backend`

### Trigger Conditions For Rollback
- admin dashboard route failure
- referral withdrawal status flow regression
- export or moderation route mismatch
- changed admin/support access behavior
