# Phase 3 Report: Visit and Lead Validation Coverage

Date: 2026-06-05
Branch: `audit-remediation-controlled`

## Completed

### Visit Validation Schemas

Extended `backend/validators/mutation-schemas.js` with schemas for:

- Visit status updates.
- Visit scheduling requests.
- Visit manager approve/reject handling.
- Visit assignment.
- Visit create-and-assign.

### Lead Validation Schemas

Extended `backend/validators/mutation-schemas.js` with schemas for:

- General lead creation.
- Lead status updates.
- Lead deletion.
- Lead reassignment.
- Builder lead creation.
- Builder lead status updates.

### Dashboard Route Coverage

Updated `backend/dashboard-routes.js`:

- `POST /visits/update-status`
- `POST /visits/schedule`
- `POST /visits/manage`
- `POST /broker/assign-visit`
- `POST /broker/visits/create-assign`
- `POST /external-sales/update-visit`
- `POST /external-sales/add-lead`
- `POST /external-sales/reassign-lead`
- `POST /external-sales/update-lead-status`

### Admin Route Coverage

Updated `backend/admin-routes.js`:

- `POST /admin/visit/status`
- `POST /admin/visit/assign`
- `POST /admin/visit/create-assign`
- `POST /admin/assign-lead`
- `POST /admin/update-lead-status`
- `POST /admin/delete-lead`

### Builder Route Coverage

Updated `backend/builder-routes.js`:

- `POST /builder/assign-visit`
- `POST /builder/leads/add`
- `POST /builder/leads/update-status`

## Design Choice

Visit status validation intentionally accepts required safe text rather than only a fixed enum. This preserves backward compatibility for any historical dashboard status labels while still blocking missing or malformed status payloads.

## Tests Run

- `node --check backend/dashboard-routes.js` - passed.
- `node --check backend/admin-routes.js` - passed.
- `node --check backend/builder-routes.js` - passed.
- `node --check backend/validators/mutation-schemas.js` - passed.
- `npm.cmd run typecheck` in `frontend` - passed.
- `npm.cmd run test` in `backend` - failed because the test harness fetches a running app instance and no server was running. Generated artifacts were restored.

## Backward Compatibility

Preserved:

- Existing visit and lead route paths.
- Existing redirects.
- Existing database write patterns.
- Existing role/permission checks.
- Existing business workflow semantics.

Changed intentionally:

- Invalid visit/lead payloads now fail before SQL execution.
- IDs are coerced and validated as positive integers.
- Required lead names and visit statuses are enforced.

## Remaining Work

Still queued:

- Task, schedule, transaction validation.
- Corporate requirement validation.
- Admin user/permission/referral/bot validation.
- Vault/wallet/favorites/partner follow validation.
- Centralized authorization migration for each mutation after validation coverage is broader.
- Full CSRF token rollout across all forms and client fetches.

## Rollback

To rollback Phase 3:

- Revert additions to `backend/validators/mutation-schemas.js`.
- Revert validation middleware additions in `backend/dashboard-routes.js`.
- Revert validation middleware additions in `backend/admin-routes.js`.
- Revert validation middleware additions in `backend/builder-routes.js`.

## Next Phase Recommendation

Proceed with Phase 4 focused on task, transaction, schedule, and corporate requirement mutations. These are adjacent to the sales/visit workflows and can reuse the same validation strategy.

