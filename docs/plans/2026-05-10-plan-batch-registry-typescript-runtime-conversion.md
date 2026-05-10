# ASK Plan Batch Registry TypeScript Runtime Conversion Plan

## Summary

Convert the plan-batch registry path behind typed helpers while preserving current `ask plan ingest`, `ask plan batch show`, `plan-mode handoff`, and `.ask/tasks/plan-batches.json` behavior. This completes the next logical TypeScript migration wave after TaskBoardProjector and keeps `SliceCloseRuntime` deferred until plan ingestion provenance is stable.

## Goals

- Preserve current source-run CLI compatibility through `node ask-core/bin/ask.js`.
- Preserve current plan-batch registry wire shape and JSON output.
- Move pure plan-batch registry behavior behind a typed TypeScript helper and source-compatible JavaScript mirror.
- Keep implementation small enough for independently closable ASK slices.

## Non-Goals

- Do not convert `PlanIngestRuntime.js` fully to TypeScript in this wave.
- Do not change `SliceCloseRuntime` behavior.
- Do not change `.ask/tasks/plan-batches.json` artifact shape.
- Do not change duplicate ingest, failed batch, or force-new-batch semantics.

## Slices

### 001 Plan Batch Registry Characterization

Add focused tests for registry defaults, invalid registry rejection, duplicate artifact hash lookup, forced new batch allocation, failed batch persistence, and `batch show` behavior.

Acceptance criteria:

- Existing `planIngest.contract.test.mjs` behavior remains covered.
- Characterization tests prove current registry shape and duplicate detection before refactor.
- No production code changes unless an existing bug is exposed.

### 002 TypeScript Helper Boundary

Add typed pure helper functions for plan-batch registry normalization and mutation behavior while keeping source-run loading safe.

Acceptance criteria:

- `ask-core/src/core/PlanBatchRegistryRuntime.ts` exports typed registry normalization, batch base construction, batch-state merge, artifact hash index merge, and batch ID allocation helpers.
- Helper contract tests compile under `npm run typecheck`.
- Source-run runtime files do not import `PlanBatchRegistryRuntime.ts` directly.

### 003 Source Runtime Helper Mirror

Add a source-compatible JavaScript helper mirror and refactor `PlanIngestRuntime.js` to delegate pure registry behavior through it.

Acceptance criteria:

- `PlanIngestRuntime.js` imports `PlanBatchRegistryRuntime.js`, not `.ts`.
- Public `PlanIngestRuntime` method names and CLI output remain unchanged.
- Plan ingest, duplicate detection, forced batch allocation, failed batch state, and batch show behavior remain unchanged.

### 004 Plan Ingest Integration Lock

Lock plan-ingest and plan-mode integration after the helper seam is active.

Acceptance criteria:

- Tests cover `plan ingest`, `plan batch show`, `plan-mode handoff`, and implementation-begin plan provenance.
- Runtime events still include `PlanIngested`, `PlanSliceMaterialized`, and plan-batch metadata.
- Existing idempotency and provenance behavior remains unchanged.

### 005 Migration Status Update

Update TypeScript migration status for the completed Plan Batch Registry Runtime Conversion wave.

Acceptance criteria:

- Docs mark Plan Batch Registry Runtime Conversion complete for this wave.
- Docs state `PlanIngestRuntime.js` remains source-compatible JavaScript while plan-batch registry helpers are typed and mirrored.
- Docs identify `SliceCloseRuntime boundary` as the next likely wave.
- Docs preserve contracts-first, runtime-conversion-later, strictness-last framing.

## Validation

Each slice must run targeted tests plus `npm run typecheck` and `npm run build` before close. Each slice must close through `node ask-core/bin/ask.js slice close <slice-id>` so ASK runs full-suite and governance checks.

Final validation:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `node ask-core/bin/ask.js pre-push-check`