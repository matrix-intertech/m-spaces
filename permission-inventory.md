# MatrixSpaces Permission Inventory Snapshot

Date: 2026-06-05
Branch: `production-hardening`

## Roles Observed

- `admin`
- `support`
- `owner`
- `builder`
- `broker`
- `external_sales`
- `corporate`
- `corporate_user`
- `tenant`
- legacy aliases: `agent`, `dealer`

## Permission Tables

Created in `backend/db-init.js`:
- `permissions`
- `role_permissions`
- `user_permissions`

Default permissions include:
- `view_overview`
- `manage_properties`
- `view_messages`
- `manage_kyc`
- `manage_visits`
- `manage_corporate`
- `view_users`
- `manage_users`
- `manage_sales`
- `manage_permissions`
- `manage_team`
- `manage_referrals`
- `manage_bot`
- builder-specific `manage_builder_*` permissions.

## Current Authorization Patterns

- `permission-utils.js` provides `getUserPermissions`, `hasPermission`, and `hasAnyPermission`.
- `admin-routes.js` defines a local `hasPermission` wrapper.
- Many routes rely on direct checks against `req.session.user.role`.
- Owner routes use `isStandardProfileRole`.
- Property access helpers exist in `property-access.js`.
- Sales-agent helpers exist in `sales-agent-utils.js` and `sales-workflow-utils.js`.

## Boundary Requirements

- Admin: platform-wide administrative access.
- Support: limited admin/support functions only.
- Owner: own properties, requirements, visits, broker assignment.
- Builder: own projects, inventory, agents, leads, visits, and assigned workflow.
- Broker: assigned properties and own team.
- Associated sales agent: manager-scoped work only.
- Independent sales agent: self-scoped work and accepted management requests.
- Buyer/guest: public discovery and explicit inquiry actions only.

## Immediate Boundary Risks

- `support` is still grouped with `admin` in some property and moderation
  paths.
- `tenant` is still grouped with `owner` in standard profile routing.
- `builder`, `broker`, and `external_sales` share broad manage permissions, but
  route scoping is inconsistent.
- Some dashboard payloads expose globally scoped datasets.

## Phase 1 Target

Introduce a centralized resource policy layer without removing existing permission checks, then migrate route mutations gradually.
