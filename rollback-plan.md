# MatrixSpaces Hardening Rollback Plan

Date: 2026-06-05
Branch: `production-hardening`

## Rollback Objective

Preserve the current working baseline while allowing incremental hardening work
 to be reverted safely if a phase introduces regressions.

## Baseline

- Source branch for this work: `audit-remediation-controlled`
- Hardening branch: `production-hardening`
- Baseline code state:
  - includes the existing remediation foundation already present on
    `audit-remediation-controlled`
  - must remain backward-compatible throughout this branch

## Rollback Strategy

### 1. Phase Isolation

- Keep each phase small and self-contained.
- Record a phase report after every completed phase.
- Do not combine unrelated security, schema, and UI changes in one commit.

### 2. Compatibility First

- Preserve existing routes, API shapes, forms, and workflow entry points.
- Prefer additive changes:
  - new policy helpers
  - compatibility middleware
  - dual writes or fallback reads during schema transitions

### 3. Revert Scope

- If a regression is isolated to one phase:
  - revert only that phase's commit set.
- If a regression affects data integrity:
  - disable the new write path first
  - preserve the old read path until rollback is complete
- If a regression affects auth or sessions:
  - revert the relevant middleware/policy change before rolling back broader
    refactors

## Data Rollback Rules

- No destructive schema changes until compatibility reads/writes are proven.
- Any new table introduced for normalization must be additive first.
- Existing columns must remain readable until migration verification is complete.
- Request-time DDL removal must be replaced by migrations before old creation
  paths are removed.

## Operational Rollback Rules

- Verify after each phase:
  - `npm.cmd run typecheck` in `frontend`
  - targeted `node --check` on touched backend files
  - relevant backend/frontend tests when available
- Preserve generated phase reports as checkpoints.
- Do not force-push or rewrite branch history during hardening.

## Rollback Triggers

- Authentication regressions
- Dashboard access regressions
- Broken owner, broker, builder, or sales workflows
- Route contract changes detected by frontend failures
- Migration drift or data write inconsistencies

## Recovery Order

1. Restore route behavior and access paths.
2. Restore stable write paths.
3. Restore compatibility reads if a new data path is involved.
4. Re-run validation and smoke checks.

## Documentation to Keep Updated

- `phase-*-report.md`
- `security-report.md`
- `permission-matrix.md`
- `role-boundary-tests.md`
- `deployment.md`
- `backup.md`
- `incident-response.md`
