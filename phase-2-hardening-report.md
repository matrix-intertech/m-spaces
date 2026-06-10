# MatrixSpaces Phase 2 Hardening Report

Date: 2026-06-05
Branch: `production-hardening`
Phase: `Phase 2 - Authorization Unification (Controlled Pass)`

## Objective

Introduce one authorization spine without breaking existing workflows, route
contracts, or dashboard behavior.

## What Was Added

New policy/service structure:

- [backend/services/authorization/index.js](/c:/Users/Shikhar/Matrixspaces/backend/services/authorization/index.js)
- [backend/services/authorization/utils.js](/c:/Users/Shikhar/Matrixspaces/backend/services/authorization/utils.js)
- [backend/policies/property-policy.js](/c:/Users/Shikhar/Matrixspaces/backend/policies/property-policy.js)
- [backend/policies/conversation-policy.js](/c:/Users/Shikhar/Matrixspaces/backend/policies/conversation-policy.js)
- [backend/policies/visit-policy.js](/c:/Users/Shikhar/Matrixspaces/backend/policies/visit-policy.js)
- [backend/policies/lead-policy.js](/c:/Users/Shikhar/Matrixspaces/backend/policies/lead-policy.js)

Core service capabilities:

- `authorize()`
- `loadAuthorizationSubject()`
- `requireAuthorization()`

Supported actions in this pass:

- `view`
- `create`
- `edit`
- `delete`
- `assign`
- `manage`
- `transfer`
- `inquire`

## Compatibility Strategy

- Existing route paths were preserved.
- Existing redirects and response styles were preserved.
- Legacy helpers were not removed.
- [authorization-service.js](/c:/Users/Shikhar/Matrixspaces/backend/authorization-service.js) now delegates property decisions to the new authorization service instead of keeping a separate implementation.

## Routes Migrated In This Pass

### Conversations

Updated [chat-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/chat-routes.js):
- conversation access middleware now checks authorization through the new
  `conversation` policy

### Broker / Builder Visit and Property Assignment Flows

Updated [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js):
- `/broker/assign-visit`
- `/broker/visits/create-assign`
- `/broker/assign-property-to-agent`

Updated [builder-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/builder-routes.js):
- `/assign-visit`

These now authorize through:
- `visit` policy for visit assignment
- `property` policy for property assignment to agents

### Sales Lead and Visit Mutations

Updated [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js):
- `/external-sales/update-visit`
- `/external-sales/add-lead`
- `/external-sales/reassign-lead`
- `/external-sales/update-lead-status`

These now authorize through:
- `visit` policy
- `lead` policy
- `property` policy when a lead is attached to a property

## Files Changed

- [backend/authorization-service.js](/c:/Users/Shikhar/Matrixspaces/backend/authorization-service.js)
- [backend/builder-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/builder-routes.js)
- [backend/chat-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/chat-routes.js)
- [backend/dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js)
- [backend/services/authorization/index.js](/c:/Users/Shikhar/Matrixspaces/backend/services/authorization/index.js)
- [backend/services/authorization/utils.js](/c:/Users/Shikhar/Matrixspaces/backend/services/authorization/utils.js)
- [backend/policies/property-policy.js](/c:/Users/Shikhar/Matrixspaces/backend/policies/property-policy.js)
- [backend/policies/conversation-policy.js](/c:/Users/Shikhar/Matrixspaces/backend/policies/conversation-policy.js)
- [backend/policies/visit-policy.js](/c:/Users/Shikhar/Matrixspaces/backend/policies/visit-policy.js)
- [backend/policies/lead-policy.js](/c:/Users/Shikhar/Matrixspaces/backend/policies/lead-policy.js)

## Verification

Passed:
- `node --check backend/services/authorization/index.js`
- `node --check backend/policies/property-policy.js`
- `node --check backend/policies/conversation-policy.js`
- `node --check backend/policies/visit-policy.js`
- `node --check backend/policies/lead-policy.js`
- `node --check backend/authorization-service.js`
- `node --check backend/chat-routes.js`
- `node --check backend/dashboard-routes.js`
- `node --check backend/builder-routes.js`
- `npm.cmd run typecheck` in `frontend`

## What This Phase Improved

- Property, conversation, visit, and lead authorization decisions now have a
  shared home.
- Route-local auth drift is reduced on the most sensitive mutation paths.
- Property authorization is no longer duplicated between the legacy helper and
  the new system.
- Team-scope checks for builder/broker/sales actions now route through shared
  policy decisions more consistently.

## What Remains For Later Phase 2/4 Work

- Admin routes still use local permission wrappers.
- Many dashboard, referral, and corporate mutations still use route-local role
  checks.
- Requirement, notification, referral, document, portfolio, and project
  policies are not yet implemented.
- Route files are still monolithic even where authorization is now cleaner.

## Recommended Next Step

Proceed to Phase 3:
- database governance cleanup
- migration inventory tightening
- request-time DDL removal
- additive `property_assignments` introduction plan
