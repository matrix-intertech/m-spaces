## Support Permission Report

### Branch
`hardening-phase-1-support-admin-separation`

### Objective
Separate `support` from admin-grade capabilities while preserving support workflows for moderation, KYC review, reports, contact messages, and user assistance.

### Baseline
Current verified engineering health before this phase: `6.4 / 10`.

The verified risk was that support could inherit broad permissions through legacy role permission bootstrap data, especially:
- `manage_properties`
- `manage_visits`
- broad admin-route access via permission checks

### Changes Implemented
- Added `backend/policies/support-policy.js`
- Added `backend/policies/admin-policy.js`
- Updated `backend/permission-utils.js` to filter support permissions at runtime
- Updated `backend/db-init.js` support defaults for future bootstrap runs
- Updated `backend/admin-routes.js` to prevent support from using user export and to mask support-facing dashboard payloads
- Added `backend/tests/support-admin-policy.test.js`
- Added `npm run test:permissions`

### Support Permissions Now Allowed
- `view_overview`
- `view_messages`
- `view_users`
- `manage_kyc`

### Support Permissions Now Blocked
- `manage_properties`
- `manage_visits`
- `manage_corporate`
- `manage_users`
- `manage_sales`
- `manage_permissions`
- `manage_team`
- `manage_referrals`
- `manage_bot`
- all builder-management permissions

### Admin Behavior
Admin users remain full-control through existing admin permission loading.

### Data Safety
No database data was modified by this phase.

Legacy support role permission rows may still exist in existing databases, but `getUserPermissions()` now filters them at runtime so stale grants do not produce effective support permissions.

### Support Dashboard Data Safety
Support-facing admin dashboard payloads now mask common email and phone fields in JSON and rendered payload data.

The `/admin/export/users` route now requires the `admin` role in addition to `view_users`.

### Regression Tests
Added targeted permission tests covering:
- support keeps moderation permissions
- support loses destructive/admin permissions even when stale grants are present
- support receives `manage_kyc` by default
- admin is distinguished from support

### Verification
Passed:
- `node --check backend/policies/admin-policy.js`
- `node --check backend/policies/support-policy.js`
- `node --check backend/permission-utils.js`
- `node --check backend/admin-routes.js`
- `node --check backend/db-init.js`
- `npm.cmd run test:permissions` in `backend`
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`

Existing backend live test:
- `npm.cmd run test` in `backend`
- Result: `9 Passed, 9 Failed`
- Public routes passed
- Authenticated role checks failed because demo logins returned `403`

### Remaining Risks
- Admin route file remains large and still needs Phase 4 cleanup.
- User-specific permission overrides for support are filtered at runtime, but the database may still contain stale grant rows.
- Support can still view user-assistance surfaces, but broader support data minimization should continue in future admin route cleanup.

### Rollback
Use `phase-1-support-admin-rollback-plan.md`.

### Phase Result
Support/admin separation is materially improved without changing routes, APIs, frontend behavior, user workflows, or database data.
