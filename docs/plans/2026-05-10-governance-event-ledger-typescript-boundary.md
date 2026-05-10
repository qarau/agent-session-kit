# Governance + Event Ledger TypeScript Boundary Plan

## Summary

Implement the next ASK-governed migration wave as Governance First, Ledger Second.

This plan does not convert the live ASK CLI to require built `dist` output. ASK still runs from `node ask-core/bin/ask.js`. Therefore, the wave uses the Typed Boundary First pattern: live runtime remains source-compatible JavaScript, while TypeScript contracts/builders define and validate the target behavior.

## Guardrails

- Preserve `ask governance status`, `ask governance explain`, and `ask governance validate` JSON field names.
- Preserve `EventLedger.append(...)` and `EventLedger.readAll()` call shape.
- Keep ASK runnable from source without requiring `npm run build`.
- Do not convert projection cursor runtime in this plan; document it as next work after ledger boundaries are stable.
- Use red tests before production or docs changes.
- Close every implementation slice through `ask slice close`.

## Slices

### 001 Governance Report Helper Extraction

Extract governance status/explain report construction from `ask-core/src/cli/commands/governance.js` into a pure source-compatible helper module while keeping the CLI command output unchanged.

Acceptance criteria:
- `ask governance status` output keeps existing top-level field names.
- `ask governance explain` output keeps existing top-level and `explanation` field names.
- Report construction can be tested without spawning the CLI.
- Existing governance surface tests pass.

### 002 TypeScript Governance Report Builder Boundary

Add TypeScript-facing governance report builder contracts that mirror the helper behavior and validate `AskGovernanceExplainReport` without changing live runtime loading.

Acceptance criteria:
- TypeScript contract layer exports governance report builder input/output types or fixture helpers.
- Contract tests prove the JS helper output shape satisfies the TS governance explain report contract.
- `npm run typecheck` and `npm run build` pass.
- No runtime dependency on `dist`, `tsx`, or a TypeScript loader is introduced.

### 003 Governance Fixture Decomposition

Split oversized governance contract fixture material into smaller fixture modules while preserving existing public exports from `governanceFixtures.ts`.

Acceptance criteria:
- Existing imports from `ask-core/src/contracts/governanceFixtures.ts` continue to work.
- Governance finding, resolution, architect validation, decision state, and explain report fixtures are grouped in focused modules.
- Existing contract tests pass.
- No public fixture symbol is renamed.

### 004 Event Ledger TypeScript Boundary Contracts

Add EventLedger TypeScript boundary contracts for append input, event envelope output, read-all output, sequencing assumptions, and metadata preservation.

Acceptance criteria:
- Contract layer represents `EventLedger.append` input and returned event envelope.
- Contract layer represents `EventLedger.readAll` output as ordered runtime event records.
- Tests cover required fields: `seq`, `type`, `ts`, `sessionId`, optional `taskId`, `actor`, `payload`, `meta`.
- Existing event contract tests pass.

### 005 Event Ledger Runtime Guard Tests

Add source-compatible EventLedger guard tests around ordering, malformed NDJSON handling expectations, metadata preservation, and sequence monotonicity.

Acceptance criteria:
- Tests document current malformed line behavior without changing it unless the current behavior is clearly unsafe and explicitly covered.
- Tests prove appended event metadata and payload are preserved.
- Tests prove read order is sorted by sequence.
- Existing ledger and projection tests pass.

### 006 Continuation Status Update

Update migration docs to record the governance and ledger boundary work and identify projection cursor conversion as the next true runtime migration step.

Acceptance criteria:
- Docs state governance decomposition and EventLedger boundary hardening are complete for this wave.
- Docs state projection cursor runtime conversion is next and still deferred.
- Docs preserve v6 framing: contracts first, runtime conversion later, strictness last.
- Docs preserve ASK ready-plan and slice-close governance requirements.

## Verification

Each slice must run targeted tests, `npm run typecheck`, `npm run build`, and close through `ask slice close <slice-id>`.

Final verification:
- `npm test`
- `node ask-core/bin/ask.js governance validate`
- `node ask-core/bin/ask.js pre-push-check`
- `git status --short --branch`
