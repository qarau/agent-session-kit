# Runtime Architecture

## Runtime Stack

ASK Forge runtime behavior is split across cooperating concerns:

- ASK runtime: orchestration, session lifecycle, execution loop, checkpointing
- Projection runtime: event replay, snapshot hydration, continuity integrity
- Architect runtime: OHDER law enforcement and architectural integrity checks
- Analyzer runtime: deterministic coupling, durability, authority, SSoT, event-only sync, duplication, security boundary, and complexity analysis
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
- `ask governance validate`: mutating governance refresh that recomputes architect/entropy state and writes a governance decision
- `ask architect status`: latest architecture law evaluation
- `ask flow status`: latest flow/behavior governance evaluation
- `ask design status`: latest design/visual governance evaluation
- `ask next`: task graph + runtime-driven next action

`ask architect status` includes an `architectureScore` payload with weighted categories for SSoT integrity, replayability, layer discipline, durability, testability, security, observability, and replaceability. The score is operational telemetry for trend visibility; hard-law blocking decisions still take precedence.

`ask architect status` also includes `architectureReview`, a deterministic council-lite envelope with survivability, replayability, security, durability, and replaceability perspectives. It is replayable evidence, not an LLM council.

`ask architect status`, `ask governance status`, `ask governance explain`, and `ask project-state` expose `ohderMode` from runtime policy. `governance explain` also includes the mode behavior summary so operators can tell whether ASK is running warning-first `fast`, hard-law `strict`, or refactor-outcome `refactor` governance.

## OHDER Analyzer Runtime

The analyzer runtime deepens step 3 and step 9 of the autonomous loop:

- Step 3, Analyze Architectural Context: analyzer engines inspect touched files and source text before the slice is judged.
- Step 9, Run OHDER Governance Validation: ArchitectRuntime writes analyzer results into `.ask/runtime/architect-status.json`.
- Step 10, Measure Entropy Impact: analyzer deltas contribute to architecture score and entropy history.
- Step 11, Trigger Refactor Governance If Needed: analyzer findings give refactor governance concrete targets.

Analyzer responsibilities:

- `OhderCouplingAnalyzerEngine`: measures touched layers, boundary spread, and risky import directions such as core depending on CLI.
- `OhderDurabilityValidatorEngine`: detects projector, snapshot, ledger, sequence, policy, and migration touchpoints.
- `OhderAuthorityAnalyzerEngine`: detects direct governed-state writes outside approved snapshot, projection, ledger, sequence, file-store, or scaffold authorities.
- `OhderSsotAnalyzerEngine`: detects duplicate governed-state authorities for the same projection, snapshot, ledger, sequence, policy, or runtime state target.
- `OhderEventOnlySyncAnalyzerEngine`: detects direct synchronization or state overwrite paths that bypass event-ledger or projection authority.
- `OhderDuplicationAnalyzerEngine`: detects meaningful copied logic across touched source files while ignoring boilerplate mirrors.
- `OhderObservabilityAnalyzerEngine`: detects blocking paths without diagnostic code/message and governance mutations without replayable events.
- `OhderTestabilityAnalyzerEngine`: detects exported runtime behavior without matching contract tests, CLI-heavy decision logic, and core/global coupling.
- `OhderReplaceabilityAnalyzerEngine`: detects core infrastructure leakage, vendor-specific runtime decisions, and speculative abstractions without current call sites.
- `OhderSecurityBoundaryAnalyzerEngine`: detects auth, token, permission, secret, session, and bypass-sensitive changes that lack matching test guardrails.
- `OhderComplexityAnalyzerEngine`: detects large files, branch-heavy code, mixed concerns, and SRP risk.

Architect status fields:

- `couplingAnalysis`
- `durabilityAnalysis`
- `authorityAnalysis`
- `ssotAnalysis`
- `eventOnlySyncAnalysis`
- `duplicationAnalysis`
- `observabilityAnalysis`
- `testabilityAnalysis`
- `replaceabilityAnalysis`
- `securityAnalysis`
- `complexityAnalysis`
- `semanticFacts`

`semanticFacts` is the normalized OHDER evidence envelope that sits beside the backward-compatible flat `ohderFacts` map. Each fact includes `metric`, `value`, `confidence`, `severity`, `source`, `evidence`, and `recommendations`. This gives future analyzers a common semantic output model without breaking existing law-pack evaluation.

The analyzer runtime is advisory unless the law pack or policy makes the finding blocking. The default path is score and entropy pressure, not automatic failure.

Future OHDER capability boundaries are documented in `future-ohder-runtime.md`; roadmap items there are not current enforcement unless they also have runtime code, tests, and operator playbooks.

## Architectural Replay Events

ASK keeps existing runtime-specific events and also emits standard architectural replay aliases:

- `CodeWritten`: changed files captured before slice commit.
- `TestPassed`: slice validation passed.
- `TestFailed`: slice validation failed.
- `ArchitectureScoreCalculated`: OHDER architecture score was calculated.
- `GovernanceGateBlocked`: a governance gate blocked continuation or close.

These events make replay analysis less coupled to individual runtime implementation names while preserving backward-compatible projections.

## OHDER-Driven Next Actions

`ask next` now maps the last decision step of the 16-step loop to an operator action. The command remains task-first: active and dependency-ready tasks are selected before OHDER fallback logic runs.

When no task is available, `ask next` evaluates architect status, replayability risk, architecture score, refactor governance, entropy trend, refactor pressure, and the latest governance decision. It may return:

- `resolve-architecture-block`: step 16 decides `block` because OHDER reports a blocking architecture state.
- `create-refactor-slice`: step 11 triggered refactor governance and the operator should preview or materialize a repair task through `ask refactor preview` or `ask refactor create`.
- `run-governance-validation`: steps 9-12 need refreshed governance validation before more work is selected.
- `await-new-requirement`: steps 13-16 are clear and the runtime is ready for a new requirement.

OHDER fallback recommendations emit `OhderNextActionRecommended` with action, reason, architect status, architecture score, blocking flag, recommended command, compact entropy summary, and refactor recommendation fingerprint when available. The event makes architecture-driven next actions replayable without creating or changing tasks.

When validation evidence is stale or entropy pressure needs confirmation, `ask next` recommends `ask governance validate`. That command emits `GovernanceValidationCompleted` and `GovernanceDecisionWritten`, then `.ask/runtime/governance-decision.json` becomes the latest explicit governance decision.

## OHDER Entropy Runtime

The entropy runtime implements steps 10, 11, and 16 of the 16-step OHDER loop for slice-close work:

- Step 10: `EntropyImpactMeasured` records `entropyScore`, `architectureScoreDelta`, `couplingDelta`, replayability risk, and `refactorPressure`.
- Step 11: `refactorPressure` gives OHDER a trend-aware signal for refactor governance.
- Step 16: `ask next` uses entropy trend to choose `create-refactor-slice`, `run-governance-validation`, or `await-new-requirement`.

`ask slice close <taskId>` appends entropy history to `.ask/runtime/metrics-history.ndjson` and recomputes `.ask/runtime/drift-analytics.json`. This means slice-close governed work contributes to architectural memory even when the autonomous continuation loop is not running.

## OHDER Refactor Governance Materialization

Refactor materialization implements step 11 of the autonomous loop without bypassing ASK task governance.

Flow:

1. OHDER entropy or architect status identifies refactor pressure.
2. `GitSliceChangeHistoryReader` and `OhderRefactorTargetDiscoveryEngine` derive concrete targets from recent `ASK-Slice` commits, changed files, entropy history, and completed OHDER refactor tasks.
3. `OhderRefactorRecommendationEngine` converts pressure and the selected target into a deterministic recommendation with fingerprint, confidence, reason, target metadata, target signals, and acceptance criteria.
4. The recommendation includes `targetPortfolio`, a ranked list of concrete refactor candidates with score, confidence, blast radius, freshness, reasons, and related slice evidence.
5. `OhderRefactorExecutionPlannerEngine` converts the recommendation and analyzer findings into actions such as `split-doc-section`, `reduce-cross-layer-import`, or `extract-responsibility`.
6. `ask next` exposes the recommendation and points to `ask refactor preview` by default.
7. `ask refactor create` materializes the recommendation as a normal ASK task when confidence policy allows it.
8. `ohder_autonomy` may allow `ask refactor create --auto` to create one bounded task, but it never applies code patches.
9. If no new target is discoverable, the recommendation is suppressed with `no-new-refactor-target` and `ask next` falls back to governance validation.
10. Approval and rejection are replayed through `RefactorApproved` and `RefactorRejected`.
11. The refactor task still executes and closes through `ask slice close <taskId>`.

This keeps OHDER detection, recommendation, materialization, approval, execution, and slice-close validation as separate runtime concerns.

`OhderPatchReadinessGate` is available for future autonomy planning. It can report whether a patch is safe to consider based on confidence, blast radius, tests, rollback plan, clean worktree, approval, and semantic facts. It always keeps patch execution disabled today.

Refactor execution plans are embedded under task origin metadata as `refactorExecutionPlan` and projected into `task.refactorGovernance.executionPlan`. High-risk plans require approval even when the recommendation itself is high confidence.

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
- `EntropyImpactMeasured`
- `EntropyTrendChanged`

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

Inspect trends with `ask metrics show --history <n>`.

Tune window size with policy key:

- `metrics.drift_window_size`

