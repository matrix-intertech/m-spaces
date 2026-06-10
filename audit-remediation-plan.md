# MatrixSpaces Audit Remediation Plan

Branch: `audit-remediation-controlled`

## Control Rules

- Preserve all current routes, APIs, redirects, forms, business workflows, and role names.
- Apply fixes in small phases with tests after each phase.
- Prefer additive compatibility layers before route-level rewrites.
- Keep rollback simple: each phase should be revertible as a small commit or file set.
- Do not delete files until usage is verified.

## Phase 0: Baseline Snapshots

### Issue
No stable remediation baseline exists for architecture, routes, permissions, or schema.

### Severity
High

### Affected Files
- `backend/server.js`
- `backend/*-routes.js`
- `backend/db-init.js`
- `backend/migrations/*.js`
- `frontend/app/**`
- `frontend/components/**`

### Implementation Strategy
- Create architecture snapshot.
- Create route inventory.
- Create permission inventory.
- Create schema snapshot.
- Use snapshots as regression references for later phases.

### Rollback Strategy
- Remove snapshot markdown files only.

## Phase 1: Authorization, CSRF, Contact Exposure, Idempotent Property GET

### Issue
Authorization checks are scattered; CSRF relies on origin/referer; contact details can be requested too easily; property detail GET creates leads and mutates notifications/recently viewed.

### Severity
High

### Affected Files
- `backend/permission-utils.js`
- `backend/property-access.js`
- `backend/property-routes.js`
- `backend/server.js`
- `backend/dashboard-routes.js`
- `backend/chat-routes.js`
- `frontend/app/property/[id]/page.tsx`
- `frontend/components/chat/StartChatButton.tsx`

### Implementation Strategy
- Add a reusable authorization service and resource policy layer.
- Add reusable ownership/assignment/management checks for properties, visits, leads, tasks, transactions, projects, and vault files.
- Introduce CSRF token minting/validation with backward-compatible rollout:
  - Expose token to server-rendered forms and Next.js pages.
  - Require token for state-changing authenticated requests once forms are updated.
  - Keep login/signup/OTP/Auth0 routes carefully allowlisted until their forms include tokens.
- Require authentication for property contact requests.
- Add contact inquiry logging and lead creation on explicit contact/chat/visit actions.
- Remove lead creation from property detail GET.
- Keep existing recently viewed and notification behavior behind explicit analytics endpoints before disabling legacy GET mutations fully.

### Rollback Strategy
- Revert added service files and property route changes.
- Disable CSRF middleware via a single config flag during emergency rollback.
- Contact endpoint can be restored to previous behavior by reverting only `property-routes.js`.

## Phase 2: Validation Layer

### Issue
Many mutations use raw `req.body` without schemas.

### Severity
High

### Affected Files
- `backend/admin-routes.js`
- `backend/auth-routes.js`
- `backend/builder-routes.js`
- `backend/dashboard-routes.js`
- `backend/owner-routes.js`
- `backend/property-routes.js`
- `backend/chat-routes.js`

### Implementation Strategy
- Add shared Zod schemas in `backend/validators`.
- Add validators per route family.
- Start with property/contact/visit/lead mutations, then admin/builder/broker/sales.

### Rollback Strategy
- Remove validator middleware from affected routes; keep schemas harmless.

## Phase 3: Service Layer

### Issue
Mega route files mix routing, authorization, validation, SQL, rendering, notifications, and email.

### Severity
High

### Affected Files
- `backend/dashboard-routes.js`
- `backend/admin-routes.js`
- `backend/auth-routes.js`
- `backend/builder-routes.js`
- `backend/owner-routes.js`

### Implementation Strategy
- Introduce `services`, `repositories`, `controllers`, and `policies` gradually.
- Move shared logic first: property assignment, lead creation, visit assignment, notifications, and user/team scope.
- Preserve route signatures.

### Rollback Strategy
- Keep wrappers thin; revert one route family at a time.

## Phase 4: Property Assignment Normalization

### Issue
Property management is split across `owner_id`, `assigned_broker_id`, and `assigned_brokers`.

### Severity
High

### Affected Files
- `backend/db-init.js`
- `backend/migrations/*.js`
- `backend/property-routes.js`
- `backend/owner-routes.js`
- `backend/dashboard-routes.js`
- `backend/builder-routes.js`

### Implementation Strategy
- Add `property_assignments` table without removing old columns.
- Backfill from existing columns.
- Update reads to prefer normalized assignments while retaining fallback.
- Update writes to dual-write during transition.

### Rollback Strategy
- Stop dual-write and fall back to existing columns.
- Keep table unused until safe to remove in a later migration.

## Phase 5: Dashboard Optimization

### Issue
Dashboards fetch large all-in-one payloads.

### Severity
Medium

### Affected Files
- `backend/dashboard-routes.js`
- `backend/admin-routes.js`
- `backend/builder-routes.js`
- `backend/owner-routes.js`
- `frontend/components/pages/RoleDashboard.tsx`
- `frontend/components/pages/OwnerDashboard.tsx`

### Implementation Strategy
- Add pagination query params while preserving existing unpaginated default responses.
- Add tab endpoints for lazy loading.
- Defer expensive sections.

### Rollback Strategy
- Keep original full payload route as default.

## Phase 6: Image, Map, and Search Optimization

### Issue
Image optimization is disabled; map bundles/pins are heavy; search uses broad selects and random ordering.

### Severity
Medium

### Affected Files
- `frontend/next.config.ts`
- `frontend/components/map/PropertyMap.tsx`
- `frontend/components/property/PropertyPhotoCarousel.tsx`
- `backend/public-routes.js`
- `backend/db-init.js`

### Implementation Strategy
- Enable responsive image sizing and CDN-friendly URLs.
- Use dynamic map imports and viewport/bounding-box APIs.
- Replace `ORDER BY RANDOM()` with scored ranking using recency, verification, and user activity.
- Use explicit SELECT columns for public listing APIs.

### Rollback Strategy
- Keep legacy query builder as fallback.
- Restore `images.unoptimized` if CDN/image loader issues appear.

## Phase 7: Dashboard Component Refactor and Styling Consolidation

### Issue
Large components and inline styles reduce maintainability.

### Severity
Medium

### Affected Files
- `frontend/components/pages/RoleDashboard.tsx`
- `frontend/components/pages/dashboardPresets.ts`
- `frontend/app/page.tsx`
- `frontend/app/globals.css`

### Implementation Strategy
- Split dashboard into shell, metrics, tables, forms, widgets, and role panels.
- Move repeated inline style blocks into shared CSS classes.
- Do not alter visual appearance.

### Rollback Strategy
- Preserve old component until new split component is verified.

## Phase 8: Dead Code and Artifact Cleanup

### Issue
Generated files, logs, temp artifacts, and possibly unused components exist in the repo.

### Severity
Low

### Affected Files
- `frontend/file.tmp`
- `frontend/et --hard commit-hash`
- `backend/*.log`
- `frontend/*.log`
- Potentially unused components after usage verification.

### Implementation Strategy
- Verify usage with static search and build.
- Remove only confirmed unused artifacts.
- Update `.gitignore`.

### Rollback Strategy
- Restore deleted files from git if any missing dependency appears.

