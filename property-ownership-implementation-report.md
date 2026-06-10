# Property Ownership Workflow Implementation Report

## Scope
Updated the property listing workflow to support explicit ownership declaration for partner and admin-side listing roles while keeping owner and standard-profile listing behavior unchanged.

## Goal Delivered
- Added an `isOwner` ownership toggle to the standalone property listing form.
- Kept owner and standard-profile users self-owned by default with no extra owner-details prompts.
- Added backend validation and persistence support for:
  - `self_owned`
  - `managed`
- Added schema support for `properties.ownership_type`.

## Roles With Ownership Toggle
- `broker`
- `builder`
- `external_sales`
- legacy `agent`
- `admin`
- `support`

## Roles Without Ownership Toggle
- `owner`
- `tenant`
- standard profile users

These users continue listing as the property owner by default.

## Behavior
### When `isOwner = true`
- Owner Details section is hidden.
- Logged-in user is used as the property owner.
- Property is saved with:
  - `owner_id = current user id`
  - `ownership_type = 'self_owned'`
- No owner detail entry is required.

### When `isOwner = false`
- Owner Details section is shown.
- Required fields:
  - `owner_name`
  - `owner_mobile`
  - `owner_email`
- Owner email is:
  - trimmed
  - lowercased before save
  - validated for email format
- Property is saved with:
  - `ownership_type = 'managed'`
- Backend creates or links the owner user record from the submitted owner details.

## Files Updated
### Frontend
- [ListPropertyForm.tsx](/c:/Users/Shikhar/Matrixspaces/frontend/components/property/ListPropertyForm.tsx)
- [OwnerPropertyModal.tsx](/c:/Users/Shikhar/Matrixspaces/frontend/components/pages/OwnerPropertyModal.tsx)
- [index.ts](/c:/Users/Shikhar/Matrixspaces/frontend/types/index.ts)

### Backend
- [property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js)
- [mutation-schemas.js](/c:/Users/Shikhar/Matrixspaces/backend/validators/mutation-schemas.js)
- [006_property_ownership_type.js](/c:/Users/Shikhar/Matrixspaces/backend/migrations/006_property_ownership_type.js)

## Database Change
Added additive schema support:
- `properties.ownership_type VARCHAR(20)`

Allowed values:
- `self_owned`
- `managed`

Migration also backfills obvious legacy cases conservatively without rewriting all historic ownership behavior.

## Validation Added
When `isOwner = false`, backend now enforces:
- `Owner name is required.`
- `Owner mobile number is required.`
- `Owner email address is required.`

## Backward Compatibility Notes
- Existing `owner_id` behavior remains intact.
- Existing dashboards and search queries continue to rely on `owner_id` and owner joins.
- Existing properties without an explicit `ownership_type` continue working.
- Owner dashboard add/edit flow stays owner-default and now submits `isOwner=true` implicitly.

## Verification Completed
- `node --check backend/property-routes.js`
- `node --check backend/validators/mutation-schemas.js`
- `node --check backend/migrations/006_property_ownership_type.js`
- `node migrate-db.js` from `backend`
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`

## Live Workflow Coverage
Code paths updated for:
- broker adds own property
- broker adds client property
- builder adds own property
- builder adds client property
- sales agent adds own property
- sales agent adds owner-managed property
- owner adds property

## Still Recommended For Manual Browser Verification
- broker add flow with `isOwner=true`
- broker add flow with `isOwner=false`
- builder add flow with `isOwner=true`
- builder add flow with `isOwner=false`
- external sales add flow with `isOwner=true`
- external sales add flow with `isOwner=false`
- owner add flow
- validation failure for blank owner fields when `isOwner=false`

## Notes
- No unrelated property workflows were intentionally changed.
- No API routes were renamed.
- No existing dashboard metrics or property assignment logic were removed.
