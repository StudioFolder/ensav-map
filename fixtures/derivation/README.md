# fixtures/derivation/

Regression fixtures for the server-side derivation logic in +page.server.ts.
See docs/refactor-plan.md R2 for why these exist.

## Layout

- `input/nocodb/` — frozen NocoDB fetch results (one JSON file per dataset).
  Frozen so the verify endpoint produces deterministic results regardless of
  NocoDB edits made after capture.
- `output/` — expected derivation outputs computed from the frozen NocoDB
  payload and the committed CSVs in static/data/.

## Usage

The dev server must be running with VITE_NOCODB_TOKEN set.

**Capture** (refreshes fixtures from the current live NocoDB state):
  curl -X POST http://localhost:5173/dev/snapshot?mode=capture

**Verify** (re-runs derivations against the frozen inputs, diffs against the
frozen outputs — the check R3 uses):
  curl -X POST http://localhost:5173/dev/snapshot?mode=verify

## When to refresh

Only when a derivation rule is intentionally changed. In that case: run capture,
inspect the diff by hand, commit the new fixtures together with the rule change
in the same commit. Do NOT refresh to make an accidental diff go away.

## Changing the NocoDB source

See `docs/data-source-changes.md` for the full runbook covering row edits,
field renames / schema changes, and adding a new dataset — all of which
interact with these fixtures differently.
