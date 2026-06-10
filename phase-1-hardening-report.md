# MatrixSpaces Phase 1 Hardening Report

Date: 2026-06-05
Branch: `production-hardening`

## Objective

Reduce confirmed P0 security and data-isolation risks without changing platform workflows, routes, or UI behavior.

## Completed In This Phase Pass

1. Scoped broker dashboard property/user payloads
2. Scoped builder unassigned-visit payloads
3. Removed support from property-admin authority
4. Removed tenant from owner-only workflow entry points
5. Replaced request-derived auth email URLs
6. Added global CSRF enforcement foundation
7. Tightened CSP by removing `unsafe-eval`

## Files Touched

- [backend/auth-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/auth-routes.js)
- [backend/authorization-service.js](/c:/Users/Shikhar/Matrixspaces/backend/authorization-service.js)
- [backend/builder-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/builder-routes.js)
- [backend/dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js)
- [backend/owner-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/owner-routes.js)
- [backend/profile-utils.js](/c:/Users/Shikhar/Matrixspaces/backend/profile-utils.js)
- [backend/property-access.js](/c:/Users/Shikhar/Matrixspaces/backend/property-access.js)
- [backend/property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js)
- [backend/server.js](/c:/Users/Shikhar/Matrixspaces/backend/server.js)
- [frontend/public/js/csrf-guard.js](/c:/Users/Shikhar/Matrixspaces/frontend/public/js/csrf-guard.js)

## Verification

Passed:
- backend syntax checks on all touched core files
- frontend typecheck
- frontend production build

Not run:
- backend live fetch test suite, because it still depends on a running server and external state

## Remaining Phase 1 Risk

- Authorization is still not unified platform-wide.
- Support/admin separation inside admin features is not fully policy-driven yet.
- CSP is improved but not yet strict.
- Tenant/owner legacy-account behavior still needs integration coverage.

## Recommended Next Step

Proceed to Phase 2:
- centralize authorization into one policy system
- migrate route-local checks onto resource policies
- add regression tests around the boundaries changed in this phase
