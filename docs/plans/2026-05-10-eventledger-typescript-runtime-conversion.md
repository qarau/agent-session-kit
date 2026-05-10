# EventLedger TypeScript Runtime Conversion Plan

## Summary

Convert the EventLedger runtime boundary toward TypeScript without breaking ASK's current source-run CLI path.

Because ASK still runs through `node ask-core/bin/ask.js`, this wave must not simply rename `EventLedger.js` to `EventLedger.ts`. Node will not load `.ts` directly. The safe migration pattern is: extract typed EventLedger behavior into a TypeScript module, keep `EventLedger.js` as the source-run compatibility runtime, and test that both paths preserve the same append/read wire behavior.

## Guardrails

- Preserve source-run CLI compatibility from `node ask-core/bin/ask.js`.
- Preserve all existing imports of `ask-core/src/runtime/EventLedger.js`.
- Preserve `.ask/runtime/events.ndjson` wire shape exactly.
- Preserve `EventLedger.append(...)` and `EventLedger.readAll()` call shape.
- Do not convert `SequenceStore`, `RuntimeProjectionEngine`, or CLI entrypoints in this wave.
- Use red tests before production or docs changes.
- Close every implementation slice through `ask slice close`.

## Slices

### 001 EventLedger Runtime Parity Tests

Add tests proving the current JS runtime and TypeScript-facing contract expectations stay aligned.

Acceptance criteria:
- Tests cover append envelope shape.
- Tests cover optional `taskId` omission.
- Tests cover default `actor`, `payload`, and `meta` values.
- Tests cover sorted `readAll` and malformed NDJSON throw behavior.
- Existing EventLedger guard tests continue to pass.

### 002 TypeScript EventLedger Runtime Helpers

Add a TypeScript helper module for event-envelope creation and event sorting.

Acceptance criteria:
- `ask-core/src/runtime/EventLedgerRuntime.ts` exports typed helper inputs/results using existing EventLedger contracts.
- Helper fixtures or contract tests compile under `npm run typecheck`.
- Helper behavior matches the JS runtime contract expectations.
- No CLI/runtime loading path imports `.ts` directly.

### 003 Source Runtime Uses Shared Behavior

Refactor the source-run `EventLedger.js` compatibility class to use shared source-compatible behavior while preserving imports and runtime loading.

Acceptance criteria:
- Existing imports of `EventLedger.js` continue to work.
- `SequenceStore.js` remains unchanged.
- `EventLedger.append()` returns the same public event envelope shape.
- `EventLedger.readAll()` preserves sorted output and malformed NDJSON behavior.
- Existing EventLedger, projection, and governance tests pass.

### 004 Migration Status Update

Update TypeScript migration status to record EventLedger runtime compatibility conversion completion.

Acceptance criteria:
- Docs mark `ask-ts-004` as runtime compatibility conversion complete for this wave.
- Docs state full source-only `.ts` runtime loading remains deferred until CLI build/shim strategy is selected.
- Docs name the next likely step as snapshot/runtime store boundary hardening or CLI build/shim strategy.
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