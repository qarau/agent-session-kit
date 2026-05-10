# Projection Cursor TypeScript Runtime Boundary Plan

## Summary

Implement the next ASK-governed TypeScript migration wave for projection cursor runtime state.

This plan does not convert the full projection engine, RuntimeSnapshotStore, or EventLedger to TypeScript. It applies the Typed Boundary First pattern: live runtime remains source-compatible JavaScript, while TypeScript contracts and tests formalize projection cursor, replay proof, sequence integrity, and projection run summary behavior.

## Guardrails

- Preserve `.ask/runtime/projection-state.json` and `.ask/runtime/replay-proof.json` wire shapes.
- Preserve `RuntimeProjectionEngine.replay()` and `projectIncremental()` public behavior.
- Preserve source-run CLI compatibility from `node ask-core/bin/ask.js`.
- Do not convert EventLedger runtime in this plan.
- Do not convert CLI entrypoints in this plan.
- Use red tests before production or docs changes.
- Close every implementation slice through `ask slice close`.

## Slices

### 001 Projection Cursor Contract Layer

Add TypeScript contracts for projection cursor state, replay proof, sequence integrity, and projection run summaries.

Acceptance criteria:
- `ask-core/src/contracts/projection.ts` exports projection cursor, replay proof, sequence integrity, and run summary contracts.
- `ask-core/src/contracts/index.ts` re-exports the new projection contracts.
- Contract fixtures compile with `satisfies`.
- `npm run typecheck` and `npm run build` pass.

### 002 Projection Runtime Contract Tests

Add tests proving the new TypeScript contracts describe current projection runtime artifacts.

Acceptance criteria:
- Tests assert the projection contract module exports the expected public contract names.
- Tests assert projection fixtures are included in TypeScript compilation.
- Tests validate representative projection-state and replay-proof field names.
- No runtime behavior changes are introduced.

### 003 Projection State Compatibility Hardening

Harden projection-state normalization in `RuntimeSnapshotStore` without changing the public file format.

Acceptance criteria:
- Missing or invalid `lastAppliedSeq` normalizes to `0`.
- Missing `requiresReplay` normalizes to `false`.
- Missing `reason` normalizes to an empty string.
- `updatedAt` remains a valid timestamp after write.
- Existing replay and incremental projection behavior remains stable.

### 004 Continuation Status Update

Update TypeScript migration continuity docs to mark projection cursor boundary work complete for this wave.

Acceptance criteria:
- Docs state projection cursor boundary/conversion is complete for this wave.
- Docs state full projection engine TypeScript conversion remains deferred.
- Docs identify EventLedger runtime conversion or snapshot/runtime store boundary hardening as the next recommended area.
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
