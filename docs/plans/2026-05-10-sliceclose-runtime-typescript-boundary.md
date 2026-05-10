# ASK SliceCloseRuntime TypeScript Boundary Hardening Plan

## Summary

Harden `SliceCloseRuntime` as the next TypeScript migration wave without rewriting the runtime or changing CLI behavior. This wave creates typed contracts and source-compatible helper seams around slice close's final governance boundary: validation, OHDER, auto-completion, auto-commit, rollback, entropy recording, and pre-push validation.

This must be implemented as an ASK-governed session: create ASK-ready markdown/JSON plan artifacts, run `ready-plan commit`, hand off to ASK, then close each implementation slice with `ask slice close`.

## Key Changes

- Add TypeScript contracts for the current slice-close public result shape.
- Characterize existing `SliceCloseRuntime.js` behavior before helper extraction.
- Add `SliceCloseRuntimeHelpers.ts` for pure helper logic.
- Add `SliceCloseRuntimeHelpers.js` as the source-compatible runtime mirror.
- Refactor `SliceCloseRuntime.js` to delegate pure helper behavior through the JS mirror only.
- Update TypeScript migration docs after the wave is complete.

## Slices

### 001 Characterize Current Slice Close Behavior

Add or extend contract tests for current slice-close behavior before changing runtime internals.

Acceptance criteria:

- Successful close still auto-completes the task, creates an `ASK-Slice` commit, runs pre-push, emits OHDER/entropy events, and records loop state.
- Dirty index still fails before task completion.
- OHDER block still leaves task `in-progress` and creates no commit.
- Commit failure still rolls task back to `in-progress`.
- Pre-push failure after commit still leaves task `completed`.
- Integrator/protected lanes still require the full suite.

### 002 Add Slice Close TypeScript Contracts

Add TypeScript-facing interfaces for slice-close result payloads.

Acceptance criteria:

- Contracts represent success and failure payloads without changing runtime output.
- Contract fixtures compile under current TypeScript settings.
- Existing check/governance contract exports remain backward-compatible.
- No runtime JS imports `.ts` files.

### 003 Add Typed Slice Close Helper Boundary

Create `ask-core/src/core/SliceCloseRuntimeHelpers.ts`.

Move only pure helper behavior into typed helpers. Do not modify `SliceCloseRuntime.js` in this slice.

Helpers to include:

- `normalizeSliceCloseValue(value): string`
- `toSliceCloseBoolean(value, fallback): boolean`
- `toSliceCloseNumber(value, fallback): number`
- `normalizeSliceCloseLower(value): string`
- `parseSliceCloseList(value, fallback, lower): string[]`
- `riskFromArchitectureScore(score): 'low' | 'medium' | 'high'`
- `entropyDimensionsFromArchitectResult(architect): object`
- `parseGitStatusPath(line): string`
- `resolveSliceCloseSummary({ taskId, lanes, fullSuiteResult }): string`
- `isRefactorGovernedSliceTask(task): boolean`

Acceptance criteria:

- New helper contract test proves the `.ts` helper exports the intended pure functions.
- Tests cover trimming, lower-casing, boolean parsing, numeric fallback, comma-list parsing, git status path parsing, refactor task detection, lane summary rendering, and entropy dimensions.
- Source inspection test confirms no runtime JS imports `SliceCloseRuntimeHelpers.ts`.
- `SliceCloseRuntime.js` remains unchanged in this slice.

### 004 Add JS Mirror and Delegate Runtime

Create `ask-core/src/core/SliceCloseRuntimeHelpers.js` and refactor `SliceCloseRuntime.js` to use it.

Acceptance criteria:

- `SliceCloseRuntime.js` imports from `./SliceCloseRuntimeHelpers.js`, not `.ts`.
- Removed inline helper definitions are replaced by equivalent helper calls.
- Public CLI behavior and payload shape are unchanged.
- Existing slice-close contract tests pass.
- New helper test proves the JS mirror behavior matches the typed helper expectations.

### 005 Update Migration Status Docs

Update `docs/operations/typescript-migration-status.md`.

Acceptance criteria:

- `ask-ts-006` says SliceCloseRuntime boundary hardening is complete for this wave.
- A new "SliceCloseRuntime TypeScript Boundary Hardening Wave" section explains what changed.
- Docs state `SliceCloseRuntime.js` remains source-compatible JavaScript while pure helpers are typed and mirrored.
- "Next Recommended Implementation Sequence" moves to law-pack/profile runtime conversion.
- Docs preserve the rule: contracts first, runtime conversion later, strictness last.

## Validation

Each slice must run targeted tests plus `npm run typecheck` and `npm run build` before close. Each slice must close through `node ask-core/bin/ask.js slice close <slice-id>` so ASK runs full-suite and governance checks.

Final validation:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `node ask-core/bin/ask.js pre-push-check`
