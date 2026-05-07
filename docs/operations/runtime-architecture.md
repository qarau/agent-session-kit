# Runtime Architecture

## Runtime Stack

ASK Forge runtime behavior is split across cooperating concerns:

- ASK runtime: orchestration, session lifecycle, execution loop, checkpointing
- Projection runtime: event replay, snapshot hydration, continuity integrity
- Architect runtime: OHDER law enforcement and architectural integrity checks
- Flow runtime: behavior continuity, protected/hard-flow guardrails
- Design runtime: visual continuity, pattern consistency, and brand drift detection

## Core Runtime Directories

Generated control plane state lives under `.ask/`:

- `.ask/runtime/events.ndjson`: ordered event ledger
- `.ask/runtime/snapshots/*.json`: projection snapshots
- `.ask/runtime/projection-state.json`: replay cursor and continuity
- `.ask/runtime/replay-proof.json`: replay hash proofs and cursor integrity evidence
- `.ask/runtime/loop-state.json`: 16-step loop execution state
- `.ask/runtime/governance-decision.json`: latest governance decision envelope
- `.ask/runtime/design-status.json`: latest design validation/discovery status
- `.ask/runtime/metrics.json`: current runtime metrics
- `.ask/runtime/metrics-history.ndjson`: per-loop metrics history
- `.ask/runtime/drift-analytics.json`: trend analysis across architecture and behavior
- `.ask/flows/*`: flow contracts, map, metrics, and history
- `.ask/design/*`: design system docs, token authority, visual map, history, and metrics
- `.ask/policy/runtime-policy.yaml`: runtime policy
- `.ask/policy/ohder-law-pack.json`: architect law pack and exemptions

## Autonomous Loop Steps

The continuation loop explicitly tracks these steps:

1. Hydrate Runtime State
2. Read Requirement
3. Analyze Architectural Context
4. Generate Intent
5. Create Slice
6. Launch Governed Codex Runtime
7. Execute Changes
8. Run Validation
9. Run OHDER Governance Validation
10. Measure Entropy Impact
11. Trigger Refactor Governance If Needed
12. Revalidate
13. Update Ledger
14. Generate Checkpoint
15. Update Resume Packet
16. Decide Continue / Retry / Block / Close

## Governance Outputs

The loop publishes operator-facing governance outputs:

- `ask governance status`: full runtime governance state
- `ask governance explain`: compact decision rationale
- `ask architect status`: latest architecture law evaluation
- `ask flow status`: latest flow/behavior governance evaluation
- `ask design status`: latest design/visual governance evaluation
- `ask next`: task graph + runtime-driven next action

`ask architect status` includes an `architectureScore` payload with weighted categories for SSoT integrity, replayability, layer discipline, durability, testability, security, observability, and replaceability. The score is operational telemetry for trend visibility; hard-law blocking decisions still take precedence.

## OHDER-Driven Next Actions

`ask next` now maps the last decision step of the 16-step loop to an operator action. The command remains task-first: active and dependency-ready tasks are selected before OHDER fallback logic runs.

When no task is available, `ask next` evaluates architect status, replayability risk, architecture score, refactor governance, and the latest governance decision. It may return:

- `resolve-architecture-block`: step 16 decides `block` because OHDER reports a blocking architecture state.
- `create-refactor-slice`: step 11 triggered refactor governance and the operator should create or ingest a repair slice.
- `run-governance-validation`: steps 9-12 need refreshed governance validation before more work is selected.
- `await-new-requirement`: steps 13-16 are clear and the runtime is ready for a new requirement.

OHDER fallback recommendations emit `OhderNextActionRecommended` with action, reason, architect status, architecture score, blocking flag, and recommended command. The event makes architecture-driven next actions replayable without creating or changing tasks.

## Slice-Close OHDER Gate

`ask slice close <taskId>` runs Architect/OHDER governance after evidence gates pass and before ASK verifies, completes, or commits the task.

The close lifecycle is:

1. session/context preflight
2. lane-required full suite
3. can-commit evidence gate
4. dirty-index guard
5. OHDER architect assessment
6. ASK verification record
7. task completion
8. `ASK-Slice` commit
9. pre-push governance check

If OHDER returns `blocking: true`, slice close returns `slice-close-ohder-blocked`, leaves the task `in-progress`, writes architecture replayability events, and does not create a commit.

Slice-close OHDER events:

- `ArchitectValidationCompleted`
- `ReplayabilityValidated`
- `ArchitectureViolationDetected`

## Drift Analytics Model

Drift analytics aggregates loop history into trend windows:

- Architecture trends:
  - entropy trend
  - coupling trend
  - replayability trend
- Behavior trends:
  - replay confidence trend
  - protected-flow violation trend
  - hard-flow violation trend
- Overall trend:
  - `improving`, `stable`, or `regressing`

Tune window size with policy key:

- `metrics.drift_window_size`
