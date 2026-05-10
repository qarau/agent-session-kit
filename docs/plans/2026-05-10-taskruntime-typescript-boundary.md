# TaskRuntime TypeScript Boundary Hardening Plan

## Summary

Move ASK's task lifecycle runtime behind a typed TypeScript boundary while preserving current JavaScript source-run CLI compatibility and existing `.ask` runtime artifact shapes.

This wave continues the TypeScript migration after EventLedger, projection cursor, and RuntimeSnapshotStore boundary work. It is intentionally limited to `TaskRuntime` and task invariant/helper behavior. It does not touch `SliceCloseRuntime`, CLI build/shim behavior, global TypeScript strictness, or runtime artifact paths.

## Guardrails

- Preserve source-run CLI compatibility from `node ask-core/bin/ask.js`.
- Preserve all existing public `TaskRuntime` methods and `ask task ...` CLI JSON output.
- Preserve current task event names, failure codes, status strings, task board snapshots, freshness snapshots, and event ledger wire shape.
- Do not change `SliceCloseRuntime`, OHDER/OFRR behavior, package bin behavior, or TypeScript strictness settings in this wave.
- Source-run JavaScript files must import `.js` helper mirrors, not `.ts` helpers.
- Use red tests before production or docs changes.
- Close every implementation slice through `ask slice close`.

## Slices

### 001 Task Runtime Characterization

Expand characterization coverage for current task lifecycle behavior before refactoring.

Acceptance criteria:
- Tests cover create, assign, start, complete, reopen, dependency add, and status behavior.
- Tests verify rejected transitions do not append new runtime events.
- Tests verify dependency add rejects missing, self, and duplicate dependencies.
- Tests verify status output enriches freshness defaults when freshness is missing.
- Existing task runtime tests continue to pass.

### 002 TypeScript Task Runtime Helper Boundary

Add typed helper functions for pure task lifecycle behavior while keeping source-run loading safe.

Acceptance criteria:
- `ask-core/src/core/TaskRuntimeHelpers.ts` exports typed normalization, freshness enrichment, task event payload, and result helper functions.
- Helper contract tests compile under `npm run typecheck`.
- Source-run runtime files do not import `TaskRuntimeHelpers.ts` directly.
- Helper behavior matches the characterization tests.

### 003 Source Runtime Uses Task Helper Seam

Add a source-compatible helper mirror and refactor `TaskRuntime.js` to delegate pure behavior through it.

Acceptance criteria:
- `ask-core/src/core/TaskRuntime.js` imports `TaskRuntimeHelpers.js`, not `.ts`.
- Public `TaskRuntime` method names and CLI output remain unchanged.
- Task lifecycle events and failure/result shapes remain unchanged.
- Existing task runtime tests and helper tests pass.

### 004 Task Invariant Boundary Decision

Harden task invariant typing if the change remains small; otherwise document invariant conversion as a deferred sub-wave.

Acceptance criteria:
- Either task invariant helpers have typed coverage and source-compatible loading, or docs explicitly defer invariant conversion.
- Existing validation error codes and allowed transition metadata remain unchanged.
- No task invariant behavior changes without characterization tests.

### 005 Migration Status Update

Update TypeScript migration status for the completed TaskRuntime boundary wave.

Acceptance criteria:
- Docs mark TaskRuntime boundary hardening complete for this wave.
- Docs state `SliceCloseRuntime` remains deferred because it owns validation, OHDER, auto-commit, rollback, and pre-push behavior.
- Docs identify the next likely step as task projector boundary or plan batch registry runtime conversion.
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