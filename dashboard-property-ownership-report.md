# Dashboard Property Ownership Implementation Report

## Goal
Organize dashboard property records by ownership classification so self-owned listings appear under a dedicated `My Properties` view while managed listings remain visible under managed/assigned property views.

## What Changed

### 1. Ownership classification expanded
Property ownership types now support richer dashboard grouping:
- `self_owned`
- `managed`
- `managed_for_owner`
- `broker_managed`
- `sales_managed`
- `builder_inventory`

### 2. Property creation now classifies ownership by role
In [property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js):
- self-owned uploads save as `self_owned`
- broker-managed client uploads save as `broker_managed`
- sales-agent managed client uploads save as `sales_managed`
- builder/admin/support managed third-party uploads save as `managed_for_owner`

### 3. Broker dashboard now separates property groups
In [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js):
- `myProperties`
- `managedProperties`
- `allPropertiesList`
- `myPropertiesTotal`
- `myPropertiesActive`
- `myPropertiesSold`
- `myPropertiesRented`
- `myPropertiesDraft`
- `managedPropertiesCount`
- `assignedPropertiesCount`

### 4. Sales dashboard now separates property groups
In [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js):
- independent sales agents get personal self-owned listings in `myProperties`
- owner-managed listings remain in `managedProperties`
- associated sales agents still keep assigned/parent-managed property visibility while personal self-owned records are split into `myProperties`

### 5. Builder dashboard now separates property groups
In [builder-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/builder-routes.js):
- self-owned builder-listed properties appear in `myProperties`
- third-party managed properties appear in `managedProperties`
- project/unit inventory remains in `inventory`

### 6. Dashboard presets updated
In [dashboardPresets.ts](/c:/Users/Shikhar/Matrixspaces/frontend/components/pages/dashboardPresets.ts):
- added sections:
  - `My Properties`
  - `Managed Properties`
  - `All Properties`
- added per-section metrics for:
  - total
  - active
  - sold
  - rented
  - draft
  - managed count
  - assigned/all count
  - project inventory where relevant

### 7. Metric system extended safely
In [RoleDashboard.tsx](/c:/Users/Shikhar/Matrixspaces/frontend/components/pages/RoleDashboard.tsx):
- added `sectionKey` support to dashboard metrics
- this allows one section such as `myProperties` to show multiple counts without breaking existing metric behavior

### 8. Property detail page shows ownership badge
In [page.tsx](/c:/Users/Shikhar/Matrixspaces/frontend/app/property/[id]/page.tsx):
- `Owner Property` when `ownership_type === 'self_owned'`
- `Managed Property` otherwise

## Builder Inventory
No public search/discovery behavior was changed.

`Builder Inventory` remains the existing `inventory_units` workflow and is still surfaced from:
- [builder-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/builder-routes.js)
- [dashboardPresets.ts](/c:/Users/Shikhar/Matrixspaces/frontend/components/pages/dashboardPresets.ts)

## Existing Owner Dashboard
The owner dashboard already has a dedicated `My Properties` section and continues to work.

This change did not remove or redesign that owner workflow.

## Migration Added
- [007_property_ownership_classification.js](/c:/Users/Shikhar/Matrixspaces/backend/migrations/007_property_ownership_classification.js)

This migration:
- widens the `ownership_type` constraint
- upgrades old `managed` rows into richer managed classifications where determinable
- keeps all existing records valid

## Files Updated
- [property-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/property-routes.js)
- [dashboard-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/dashboard-routes.js)
- [builder-routes.js](/c:/Users/Shikhar/Matrixspaces/backend/builder-routes.js)
- [007_property_ownership_classification.js](/c:/Users/Shikhar/Matrixspaces/backend/migrations/007_property_ownership_classification.js)
- [dashboardPresets.ts](/c:/Users/Shikhar/Matrixspaces/frontend/components/pages/dashboardPresets.ts)
- [RoleDashboard.tsx](/c:/Users/Shikhar/Matrixspaces/frontend/components/pages/RoleDashboard.tsx)
- [page.tsx](/c:/Users/Shikhar/Matrixspaces/frontend/app/property/[id]/page.tsx)
- [index.ts](/c:/Users/Shikhar/Matrixspaces/frontend/types/index.ts)

## Verification Completed
- `node --check backend/property-routes.js`
- `node --check backend/dashboard-routes.js`
- `node --check backend/builder-routes.js`
- `node --check backend/migrations/007_property_ownership_classification.js`
- `node migrate-db.js` in `backend`
- `npm.cmd run typecheck` in `frontend`
- `npm.cmd run build` in `frontend`

## Manual Browser Checks Still Recommended
1. Broker uploads own property -> appears in `My Properties`
2. Broker uploads client property -> appears in `Managed Properties`
3. Builder uploads own property -> appears in `My Properties`
4. Builder inventory still appears in `Inventory`
5. Independent sales uploads own property -> appears in `My Properties`
6. Independent sales uploads owner property -> appears in `Managed Properties`
7. Owner dashboard still shows self-owned properties correctly
8. Property detail page shows ownership badge correctly

## Non-Goals Preserved
- no search/discovery changes
- no chat workflow changes
- no visit workflow changes
- no lead workflow changes
- no assignment workflow removal
- no API route renames
- no public listing visibility changes
