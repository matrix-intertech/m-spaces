# Phase 1 Report: Authorization, CSRF, Contact Exposure, and Explicit Inquiry Leads

Date: 2026-06-05
Branch: `audit-remediation-controlled`

## Completed

### Centralized Authorization Foundation

Added `backend/authorization-service.js` with reusable helpers for:

- Role normalization.
- Admin/support recognition.
- Property lookup.
- Property management authorization.
- Owner/manager assignment checks.
- Explicit inquiry authorization.
- Property policy middleware.

This is additive and does not remove existing route checks yet.

### CSRF Foundation

Added `backend/csrf-protection.js` with:

- Session-backed CSRF token creation.
- Readable `XSRF-TOKEN` cookie support.
- Header/body/query token validation.
- Reusable `requireCsrf` middleware.
- `/api/csrf-token` endpoint in `backend/server.js`.

Applied CSRF protection to:

- `POST /property/:id/request-contact`
- `POST /chat/conversations/:propertyId/start`

Global CSRF enforcement is intentionally staged until all existing forms and client requests include tokens.

### Contact Exposure Protection

Updated `backend/property-routes.js`:

- Property contact requests now require authentication.
- Contact requests are CSRF-protected.
- Contact requests are rate-limited.
- Contact requests validate inquiry rights.
- Contact requests are logged through `contact_inquiries`.
- Contact requests create sales leads only on explicit inquiry.

Updated `frontend/app/property/[id]/page.tsx`:

- Logged-out users see a login CTA instead of the contact form.
- Logged-in users submit a CSRF token with the contact request.

### Explicit Lead Generation

Removed automatic lead creation from property detail GET.

Added explicit lead creation/logging to:

- Contact request.
- Chat initiation.

### Database Compatibility

Added `contact_inquiries` creation in `backend/db-init.js`.

The table is additive and does not change existing table behavior.

## Tests Run

- `node --check backend/server.js` - passed.
- `node --check backend/property-routes.js` - passed.
- `node --check backend/chat-routes.js` - passed.
- `npm.cmd run typecheck` in `frontend` - passed.
- `npm.cmd run test` in `backend` - failed because the test harness fetches a running app instance and no server was running. Generated `backend/test-results.txt` was restored.

## Backward Compatibility

Preserved:

- Existing property page route.
- Existing contact-request URL.
- Existing email contact workflow.
- Existing chat-start API response.
- Existing property route rendering.
- Existing lead table behavior.

Changed intentionally:

- Contact request now requires login.
- Contact/chat explicit inquiry creates leads.
- Property detail GET no longer creates leads.

Still staged:

- Full GET idempotency for recently viewed and notification read updates.
- Global CSRF enforcement for all mutations.
- Migration of every route family to centralized authorization policies.

## Rollback

To rollback Phase 1:

- Remove `backend/authorization-service.js`.
- Remove `backend/csrf-protection.js`.
- Remove `backend/inquiry-service.js`.
- Revert changes in `backend/server.js`.
- Revert changes in `backend/db-init.js`.
- Revert changes in `backend/property-routes.js`.
- Revert changes in `backend/chat-routes.js`.
- Revert changes in `frontend/services/api.ts`.
- Revert changes in `frontend/app/property/[id]/page.tsx`.
- Revert changes in `frontend/components/chat/StartChatButton.tsx`.

`contact_inquiries` is additive and can remain unused safely if rollback occurs after deployment.

## Next Phase Recommendation

Proceed to Phase 2 with Zod validation and route-family authorization migration for:

1. Property add/edit/delete.
2. Visit schedule/update/assign.
3. Lead create/update/reassign.
4. Owner broker assignment.

