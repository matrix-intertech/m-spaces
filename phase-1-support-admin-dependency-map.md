## Phase 1 Support/Admin Separation Dependency Map

### Objective
Separate `support` from admin-grade capabilities while preserving existing support workflows for moderation, KYC review, reports, user assistance, and conversation review.

### Primary Files
- `backend/db-init.js`
- `backend/permission-utils.js`
- `backend/authorization-service.js`
- `backend/property-access.js`
- `backend/admin-routes.js`
- `backend/services/authorization/index.js`
- `backend/policies/property-policy.js`
- `backend/policies/conversation-policy.js`

### Permission Sources
- `role_permissions` bootstrap data in `backend/db-init.js`
- user-specific overrides through `user_permissions`
- shared permission helpers in `backend/permission-utils.js`
- route-local admin middleware in `backend/admin-routes.js`
- resource policies under `backend/policies`

### Support Workflows To Preserve
- view admin overview where allowed
- view messages and conversation moderation
- review KYC when permissioned
- review reports and support requests
- assist users without ownership or permission override authority

### Admin-Only Workflows
- delete properties
- edit platform permissions
- manage team permissions
- modify ownership-sensitive property state
- manage platform-level users and roles
- execute destructive property/user operations

### Coupling Risks
- `support` receives role permissions from bootstrap data.
- admin routes rely on permission names rather than role-specific policies.
- conversation moderation intentionally allows support.
- property authorization no longer treats support as admin, but admin routes may still grant support broad permission-based access.

### Verification Targets
- support cannot receive inherited `manage_properties`, `manage_visits`, `manage_permissions`, `manage_team`, or `manage_users`.
- support can retain `view_overview`, `view_messages`, `view_users`, and `manage_kyc` where intended.
- admin remains full-control.
- support cannot pass property manage/delete policy checks.
- conversation moderation remains available for support.
