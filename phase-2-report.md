# Phase 2 Report: Mutation Validation and Targeted Authorization Hardening

Date: 2026-06-05
Branch: `audit-remediation-controlled`

## Completed

### Reusable Validation Layer

Added `backend/validators/mutation-schemas.js` with Zod schemas for:

- Contact request.
- Property review.
- Property creation.
- Property deletion.
- Owner property edit.
- Chat conversation start.
- Chat message send.

Updated `backend/validate.js`:

- Supports both Zod v3-style `errors` and Zod v4-style `issues`.
- Replaces `req.body` with parsed/coerced data so downstream handlers receive normalized values.
- Preserves existing JSON and rendered-form error behavior.

### Property Mutation Validation

Updated `backend/property-routes.js`:

- `POST /property/:id/request-contact` now validates body shape.
- `POST /property/:id/review` now validates rating/comment.
- `POST /property/add` now validates core property listing fields.
- `POST /property/delete` now validates property ID.

### Chat Mutation Validation

Updated `backend/chat-routes.js`:

- `POST /chat/conversations/:propertyId/start` now validates body shape.
- `POST /chat/conversations/:convId/message` now validates message content.

### Owner Property Edit Authorization

Updated `backend/owner-routes.js`:

- `POST /property/edit`
- `POST /owner/property/edit`

Both now use:

- `ownerPropertyEditSchema`.
- Centralized `canManageProperty` policy from `authorization-service.js`.

This removes duplicate manager-scope logic from the route while preserving the route and update behavior.

## Tests Run

- `node --check backend/property-routes.js` - passed.
- `node --check backend/chat-routes.js` - passed.
- `node --check backend/owner-routes.js` - passed.
- `node --check backend/validate.js` - passed.
- `npm.cmd run typecheck` in `frontend` - passed.
- `npm.cmd run test` in `backend` - failed because the test harness fetches a running app instance and no server was running. Generated artifacts were restored.

## Backward Compatibility

Preserved:

- Existing route paths.
- Existing redirect behavior.
- Existing form submission style.
- Existing JSON validation error shape.
- Existing property add/edit/delete workflows.
- Existing chat response shape.

Changed intentionally:

- Invalid mutation payloads are rejected earlier with validation errors.
- Coercible IDs and numbers are normalized before handlers use them.
- Owner property edit now uses centralized policy logic.

## Remaining Validation Work

Still queued for later phases:

- Visit schedule/update/assign routes.
- Lead create/update/reassign routes.
- Broker and builder sales/task/transaction routes.
- Admin user/permission/corporate/referral/bot routes.
- Vault and wallet routes.
- Partner follow/favorite/compare mutations.

## Rollback

To rollback Phase 2:

- Remove `backend/validators/mutation-schemas.js`.
- Revert `backend/validate.js`.
- Revert validation middleware additions in `backend/property-routes.js`.
- Revert validation middleware additions in `backend/chat-routes.js`.
- Revert `backend/owner-routes.js` authorization/validation update.

## Next Phase Recommendation

Proceed with Phase 3 focused on visit and lead workflows:

1. Add Zod schemas for visit schedule/update/assign.
2. Add Zod schemas for lead create/update/reassign.
3. Apply centralized authorization to broker, builder, and sales lead/visit mutations.
4. Run syntax/type/live-harness checks and write Phase 3 report.

