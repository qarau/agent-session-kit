# RuntimeSnapshotStore TypeScript Boundary Hardening Plan

## Summary

Harden `RuntimeSnapshotStore` as the next TypeScript migration wave while preserving ASK source-run JavaScript CLI compatibility and all existing `.ask` snapshot file formats.

This wave follows the current migration rule: contracts first, runtime conversion later, strictness last. It does not convert the CLI entrypoint, change package-bin behavior, or enable global TypeScript strictness.

## Guardrails

- Preserve source-run CLI compatibility from `node ask-core/bin/ask.js`.
- Preserve all existing imports of `ask-core/src/runtime/RuntimeSnapshotStore.js`.
- Preserve `.ask/runtime/snapshots/*`, `.ask/runtime/projection-state.json`, and replay proof wire shapes.
- Preserve public `RuntimeSnapshotStore` method names and fallback behavior.
- Do not convert CLI entrypoints, `AskPaths`, `FileStore`, or `RuntimeProjectionEngine` in this wave.
- Do not enable strict TypeScript settings in this wave.
- Use red tests before production or docs changes.
- Close every implementation slice through `ask slice close`.

## Slices

### 001 Snapshot Contract Coverage

Add TypeScript contract coverage for current snapshot runtime artifacts.

Acceptance criteria:
- Snapshot runtime contracts are exported from the TypeScript contract layer.
- Contracts cover session, task board, task-indexed snapshots, projection state, replay proof, and runtime snapshot artifact grouping.
- Fixture coverage compiles under `npm run typecheck`.
- Existing current artifact contracts remain compatible.

### 002 Snapshot Defaults and Normalization Tests

Add tests that lock current `RuntimeSnapshotStore` default and normalization behavior before refactoring.

Acceptance criteria:
- Tests cover session fallback behavior.
- Tests cover task-indexed snapshot fallback behavior for representative verification/workflow/freshness snapshots.
- Tests cover projection state normalization for missing, invalid, and loose payloads.
- Tests cover replay proof default/merge behavior.
- Existing replay projection tests continue to pass.

### 003 TypeScript Snapshot Runtime Helpers

Add typed helper functions for snapshot defaults and normalization while keeping source-run loading safe.

Acceptance criteria:
- `ask-core/src/runtime/RuntimeSnapshotStoreRuntime.ts` exports typed default and normalization helpers.
- Helper fixtures or contract tests compile under `npm run typecheck`.
- Helper behavior matches the runtime default and normalization tests.
- Source-run runtime files do not import `RuntimeSnapshotStoreRuntime.ts` directly.

### 004 Source Runtime Uses Snapshot Helper Seam

Refactor `RuntimeSnapshotStore.js` to delegate defaults and normalization through a source-compatible helper mirror.

Acceptance criteria:
- `RuntimeSnapshotStore.js` imports `RuntimeSnapshotStoreRuntime.js`, not `.ts`.
- Public `RuntimeSnapshotStore` method names remain unchanged.
- Snapshot fallback, projection state normalization, and replay proof merge behavior remain unchanged.
- `AskPaths`, `FileStore`, and `RuntimeProjectionEngine` remain unchanged.
- Existing projection and runtime snapshot tests pass.

### 005 Migration Status Update

Update TypeScript migration status for the completed snapshot/runtime store boundary wave.

Acceptance criteria:
- Docs mark snapshot/runtime store boundary hardening complete for this wave.
- Docs state full source-only `.ts` runtime loading remains deferred until CLI build/shim strategy is selected.
- Docs identify the next likely step as task/slice runtime conversion or CLI build/shim strategy.
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
