# ASK Runtime Stall Recovery Design

Date: 2026-03-12  
Branch: `ask-hard-cutover`

## Problem

During ASK runtime checks, long-running or blocked command execution can appear hung. This has caused manual interrupts (`Ctrl+C`) and explicit `continue` restarts. Reliability drops further when session compaction/re-hydration occurs mid-operation.

## Goals

1. Detect stalled runtime command execution with deterministic timeout behavior.
2. Retry once automatically on stall before failing.
3. Persist operation state so stalled runs are diagnosable and resumable.
4. Add a runtime inspection command to report last operation and recovery guidance.
5. Keep failure semantics strict for real command errors (no blind retries).

## Non-Goals

1. Building a general background job scheduler.
2. Retrying arbitrary non-zero exits from governance checks.
3. Changing hook policy semantics for pass/fail conditions.

## Chosen Approach

Implement a shared ask-core guarded execution layer and use it from the session-kit adapters.

### Why

1. Centralizes timeout/retry behavior instead of duplicating logic per adapter.
2. Produces one deterministic operation-state contract under `.ask/runtime/last-operation.json`.
3. Keeps adapter code thin and policy-focused.
4. Enables `ask session doctor` to inspect one canonical operation state source.

## Architecture

### 1) Guarded Command Runner

Create `ask-core/src/core/GuardedCommandRunner.js`:

1. Executes child commands with:
   - `wallTimeoutMs = 180000`
   - `noOutputTimeoutMs = 180000`
   - `maxRetriesOnStall = 1`
2. Detects stall reasons:
   - `wall-timeout`
   - `no-output-timeout`
3. Retries exactly once only for stall reasons.
4. Does not retry normal non-zero command exits.

### 2) Operation State Persistence

Write `.ask/runtime/last-operation.json` with deterministic state transitions:

1. `running`
2. `retrying`
3. `succeeded`
4. `failed`

Minimum payload:

```json
{
  "operation": "pre-commit-adapter:ask pre-commit-check",
  "status": "retrying",
  "attempt": 1,
  "maxAttempts": 2,
  "startedAt": "2026-03-12T10:00:00.000Z",
  "updatedAt": "2026-03-12T10:03:00.000Z",
  "failureReason": "no-output-timeout",
  "command": {
    "bin": "node",
    "args": ["ask.js", "pre-commit-check"]
  }
}
```

### 3) Adapter Integration

Update:

1. `ask-core/src/adapters/sessionKit/runPreCommitAdapter.js`
2. `ask-core/src/adapters/sessionKit/runPrePushAdapter.js`

Each adapter step (`init`, `session start`, `context verify`, final check) runs via guarded runner and updates operation state.

### 4) Doctor Command

Extend `ask session doctor` in `ask-core/src/cli/commands/session.js`:

1. Read `.ask/runtime/last-operation.json`.
2. Return deterministic JSON summary:
   - latest status
   - retry count
   - last failure reason (if any)
   - recovery action
3. If state is stale `running`, recommend safe resume command sequence.

## Failure Semantics

1. Stall on first attempt -> auto-retry once.
2. Stall on second attempt -> fail with exit code 1 and `failed` state.
3. Non-zero command exit (policy/check failure) -> fail immediately with exit code 1.

## Testing Strategy (TDD)

1. Add red tests for guarded runner:
   - retries once on stall then succeeds
   - fails after second stall
   - does not retry normal non-zero exit
2. Add red tests for state file transitions and fields.
3. Add red tests for `ask session doctor` output contract.
4. Keep adapter migration tests green.
5. Run full suite before merge.

## Risks and Mitigations

1. Risk: timeout values too aggressive for slower environments.
   - Mitigation: conservative default `180s` and explicit no-output + wall timeout parity.
2. Risk: false-positive stale `running` state after abrupt termination.
   - Mitigation: doctor command treats stale state as advisory with deterministic recovery guidance.
3. Risk: masking true policy failures through retry.
   - Mitigation: retries only on stall reasons, never on normal non-zero exits.

## Acceptance Criteria

1. Adapter commands auto-retry once on stall and then fail deterministically.
2. `.ask/runtime/last-operation.json` is present and accurate through all states.
3. `ask session doctor` reports actionable recovery guidance.
4. Existing governance/runtime contract tests remain green.
