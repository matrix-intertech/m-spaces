## Phase 1 Support/Admin Separation Rollback Plan

### Rollback Scope
This phase changes only support/admin authorization and permission defaults. It must not alter frontend UI, routes, API shapes, database data, or business workflows.

### Files To Revert If Needed
- `backend/db-init.js`
- `backend/permission-utils.js`
- `backend/admin-routes.js`
- `backend/policies/*`
- `backend/services/authorization/*`
- phase reports and regression documentation

### Rollback Method
Use a targeted file revert from the previous branch state for only the files touched by this phase. Do not reset the repository or discard unrelated hardening work.

### Operational Rollback
If support users lose required assistance access:
- restore the previous support permission list in `backend/db-init.js`
- re-run the migration/bootstrap path only in a controlled environment
- confirm support can still view messages, KYC, reports, and user assistance surfaces

### Safety Checks Before Rollback
- confirm the failing role is `support`, not an admin user with custom overrides
- inspect user-specific permissions in `user_permissions`
- verify whether the failure is route-level permission, resource policy, or frontend visibility

### Validation After Rollback
- backend syntax checks
- frontend typecheck
- support/admin permission regression checks
- manual admin dashboard smoke test
