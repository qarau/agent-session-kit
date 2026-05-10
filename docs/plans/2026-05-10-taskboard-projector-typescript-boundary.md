# TaskBoardProjector TypeScript Boundary Hardening Plan

## Summary

Harden ASK's task-board projection runtime as the next TypeScript migration wave while preserving current JavaScript source-run CLI compatibility and task-board snapshot wire shape.

This wave follows the completed TaskRuntime boundary work. It types and isolates the pure projection behavior that turns task lifecycle events into task-board snapshot state. It does not convert `RuntimeProjectionEngine.js`, `PlanIngestRuntime.js`, `SliceCloseRuntime.js`, CLI entrypoints, or TypeScript strictness settings.

## Guardrails

- Preserve `TaskBoardProjector.initialState()` and `TaskBoardProjector.apply(state, event)` public behavior.
- Preserve task-board snapshot fields and existing ignored-event behavior.
- Preserve `RefactorTaskGovernance.js` behavior; only lock integration with `TaskBoardProjector`.
- Source-run JavaScript files must import `.js` helper mirrors, not `.ts` helpers.
- Do not change `RuntimeProjectionEngine.js`, `PlanIngestRuntime.js`, `SliceCloseRuntime.js`, or CLI entrypoints in this wave.
- Use red tests before production or docs changes.
- Close every implementation slice through `ask slice close`.

## Slices

### 001 Projector Characterization

Add characterization coverage for current `TaskBoardProjector` task lifecycle projection behavior before refactoring.

Acceptance criteria:
- Tests cover unknown or taskless events leaving state unchanged.
- Tests cover `TaskCreated`, `TaskAssigned`, `TaskStarted`, `TaskCompleted`, `TaskReopened`, `TaskBlocked`, and `TaskDependencyAdded` behavior.
- Tests verify acceptance criteria are trimmed and empty values removed.
- Tests verify dependencies remain sorted and unique.
- Existing projection and task runtime tests continue to pass.

### 002 TypeScript Projector Helper Boundary

Add typed helper functions for pure task-board projection behavior while keeping source-run loading safe.

Acceptance criteria:
- `ask-core/src/runtime/projectors/TaskBoardProjectorHelpers.ts` exports typed task ID normalization, base task creation, task state replacement, acceptance criteria normalization, dependency merge/sort, and safe object clone helpers.
- Helper contract tests compile under `npm run typecheck`.
- Source-run runtime files do not import `TaskBoardProjectorHelpers.ts` directly.
- Helper behavior matches the characterization tests.

### 003 Source Runtime Uses Projector Helper Seam

Add a source-compatible helper mirror and refactor `TaskBoardProjector.js` to delegate pure behavior through it.

Acceptance criteria:
- `TaskBoardProjector.js` imports `TaskBoardProjectorHelpers.js`, not `.ts`.
- Public `TaskBoardProjector` method names and return shapes remain unchanged.
- Task lifecycle projection behavior remains unchanged.
- Existing projector, replay projection, task runtime, helper, typecheck, and build validations pass.

### 004 Refactor Governance Projection Integration

Lock `RefactorTaskGovernance.js` integration with `TaskBoardProjector` without changing refactor governance behavior.

Acceptance criteria:
- Tests cover `RefactorApproved` and `RefactorRejected` task-board projection integration.
- `RefactorTaskGovernance.js` behavior remains unchanged.
- Refactor approval keeps existing task metadata while updating refactor governance state.
- Refactor rejection blocks the task and preserves existing metadata.

### 005 Migration Status Update

Update TypeScript migration status for the completed TaskBoardProjector boundary wave.

Acceptance criteria:
- Docs mark TaskBoardProjector boundary hardening complete for this wave.
- Docs state `RuntimeProjectionEngine.js` remains source-compatible JavaScript while task-board projection helpers are typed.
- Docs identify `Plan Batch Registry Runtime Conversion` as the next likely wave.
- Docs preserve contracts-first, runtime-conversion-later, strictness-last framing.

## Verification

Each slice must run targeted tests, `npm run typecheck`, `npm run build`, and close through `ask slice close <slice-id>`.

Final verification:
- `npm test`
- `npm run typecheck`
- `npm run build`
- `node ask-core/bin/ask.js governance validate`
- `node ask-core/bin/ask.js pre-push-check`
- `git status --short --branch`