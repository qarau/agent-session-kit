# ASK 3.0 Architecture

ASK 3.0 evolves ASK from commit/push gate enforcement into a Session OS runtime.

## Runtime Layers

1. Event ledger:
   - Append-only runtime events at `.ask/runtime/events.ndjson`.
   - Monotonic sequencing via `.ask/runtime/sequence.json`.
2. Replay + projection:
   - `ask replay` reconstructs state into `.ask/runtime/snapshots/*`.
   - Snapshots cover session, task, verification, workflow, freshness, integration, routing, claims, agents, policy packs, and delivery governance.
3. Command contracts:
   - Session/policy: `session`, `context`, `preflight`, `can-commit`, `pre-commit-check`, `pre-push-check`.
   - Execution/runtime: `task`, `evidence`, `verify`, `workflow`, `integration`, `integration-auto`.
   - Agent coordination: `route`, `claim`, `child-session`, `agent`, `policy`.
   - Delivery governance: `feature`, `release`, `promote`, `rollout`, `rollback`.
4. Hook adapters:
   - Git hooks invoke ask-core adapter wrappers for deterministic runtime checks.
   - Guarded runner manages no-output/wall-time stalls with one automatic retry.

## Why This Model

- Rebuildable state from an event log.
- Deterministic contracts that are testable per runtime slice.
- Better resilience for long-running agent workflows.
- Clear path from local operator docs to runtime-enforced policies.

## Migration Path

Use two explicit operating modes:

- Bridge mode:
  - Keep legacy doc-driven and hook workflows active.
  - Run event-ledger/projection in parallel.
  - Require parity checks before deprecating legacy reads.
- Cutover mode:
  - Projection snapshots are authoritative.
  - Legacy direct-state mutation paths are removed.
  - Session docs remain required evidence, not runtime source-of-truth.
