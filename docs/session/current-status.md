# Current Status

Last updated: 2026-03-14

## Branch and Head

- Active branch: `ask-3-phase1-event-ledger`
- Current HEAD: `7fb1afc feat: add policy packs and queue class runtime`

## Active Objective

Execute ASK 3.0 Task 12 (documentation + installer surface + release gating) after Task 11 runtime slice completion.

## Completed In This Stream

- Task 11 RED/GREEN delivery governance runtime implemented:
  - Added release governance runtimes (`FeatureRuntime`, `ReleaseTrainRuntime`, `PromotionRuntime`, `RolloutRuntime`).
  - Added delivery governance projectors (`FeatureProjector`, `ReleaseTrainProjector`, `PromotionGateProjector`, `RolloutProjector`).
  - Added CLI families: `ask feature`, `ask release`, `ask promote`, `ask rollout`, `ask rollback`.
  - Extended replay/snapshot wiring for `features.json`, `release-trains.json`, `promotion-gates.json`, and `rollout.json`.
  - Added contract tests in `ask-core/tests/deliveryGovernance.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/deliveryGovernance.contract.test.mjs` failed initially (delivery governance command surface missing).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/deliveryGovernance.contract.test.mjs` passed (4/4).
- Task 10 RED/GREEN queue classes and policy packs implemented:
  - Added queue class and policy registries (`QueueClassRegistry`, `ExecutionPolicyPackRegistry`).
  - Added task classification and policy execution runtime (`TaskClassifier`, `ExecutionPolicyRuntime`).
  - Added queue class / policy pack projectors and snapshots (`QueueClassProjector`, `PolicyPackProjector`).
  - Added `ask policy classify|apply|status` command family.
  - Extended workflow recommendation bridge to consume queue class signals.
  - Added contracts in `ask-core/tests/policyPacks.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/policyPacks.contract.test.mjs` failed initially (missing policy runtime/CLI and snapshot wiring).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/policyPacks.contract.test.mjs` passed (3/3).
  - `cmd /c npm run ask:verify:phase5` passed (agent + policy contracts 6/6 + repo tests 20/20).
- Task 9 RED/GREEN agent coordination implemented:
  - Added runtime modules for routing, claims, child sessions, and agents (`RoutingRuntime`, `ClaimRuntime`, `ChildSessionRuntime`, `AgentRuntime`).
  - Added policy helpers for capability matching and routing decisions (`AgentCapabilityRegistry`, `RoutingPolicyEngine`).
  - Added replay projectors for claims, routing, child sessions, and agents.
  - Added CLI surfaces `ask route`, `ask claim`, `ask child-session`, and `ask agent`.
  - Added deterministic coordination contracts in `ask-core/tests/agentCoordination.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/agentCoordination.contract.test.mjs` failed initially (`route` / `claim` / `child-session` / `agent` command surface missing).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/agentCoordination.contract.test.mjs` passed (3/3).
  - `cmd /c npm run ask:verify:phase5` passed (agent coordination contracts 3/3 + repo tests 20/20).
- Task 8 RED/GREEN integration orchestration implemented:
  - Added integration runtime stack (`IntegrationRuntime`, `AutoIntegrationRuntime`, branch/planner/orchestrator/workspace git helpers).
  - Added integration and merge-readiness projectors (`IntegrationProjector`, `MergeReadinessProjector`).
  - Added integration CLI command families (`ask integration plan|run|status`, `ask integration-auto run|status`).
  - Extended replay snapshots with `integration.json` and `merge-readiness.json`.
  - Added integration orchestration contracts in `ask-core/tests/integrationRuntime.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/integrationRuntime.contract.test.mjs` failed initially (`integration`/`integration-auto` commands missing).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/integrationRuntime.contract.test.mjs` passed (3/3).
  - `cmd /c npm run ask:verify:phase4` passed (freshness + integration contracts 6/6 + repo tests 20/20).
- Task 7 RED/GREEN dependency-aware freshness implemented:
  - Added dependency graph runtime utility (`DependencyGraph`).
  - Added freshness projection/runtime layer (`FreshnessProjector`, `FreshnessRuntime`) with stale/fresh/unverified status computation.
  - Added task dependency runtime command (`ask task depends`) via `TaskDependencyAdded` event.
  - Added freshness CLI command family (`ask freshness status|explain`).
  - Extended projection/snapshot wiring to persist freshness snapshot (`freshness.json`).
  - Extended workflow adapter/runtime integration to consume freshness signal for stale-task routing.
  - Added integration contracts in `ask-core/tests/freshness.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/freshness.contract.test.mjs` failed initially (`task depends` / `freshness` commands unavailable).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/freshness.contract.test.mjs ask-core/tests/taskRuntime.contract.test.mjs ask-core/tests/workflowAdapter.contract.test.mjs ask-core/tests/superpowersEnterprise.contract.test.mjs` passed (13/13).
  - `cmd /c npm run ask:verify:phase4` passed (freshness contracts 3/3 + repo tests 20/20).
- Task 6A RED/GREEN enterprise superpowers guardrails implemented:
  - Added provider guardrail modules for version pinning, skill allowlist, and compatibility harness.
  - Extended `SuperpowersAdapter` with provider policy enforcement, compatibility status reporting, and deterministic kill-switch fallback.
  - Added policy-wired workflow registry/runtime loading and `ask workflow-provider status` CLI command.
  - Added integration contracts in `ask-core/tests/superpowersEnterprise.contract.test.mjs` (adapter + policy/CLI wiring).
- RED verification:
  - `cmd /c node --test ask-core/tests/superpowersEnterprise.contract.test.mjs` failed initially (policy wiring and `workflow-provider` CLI missing).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/superpowersEnterprise.contract.test.mjs ask-core/tests/workflowAdapter.contract.test.mjs` passed (8/8).
  - `cmd /c npm run ask:verify:phase3` passed (phase contracts 8/8 + repo tests 20/20).
- Task 6 RED/GREEN workflow adapter runtime implemented:
  - Added adapter base/registry/superpowers adapter (`WorkflowAdapter`, `WorkflowRegistry`, `SuperpowersAdapter`).
  - Added workflow runtime + projector (`WorkflowRuntime`, `WorkflowProjector`).
  - Added `ask workflow recommend|start|artifact|complete|fail` command.
  - Added workflow snapshot wiring (`AskPaths`, `RuntimeSnapshotStore`, `RuntimeProjectionEngine`, `Scaffolder`).
  - Added `ask-core/tests/workflowAdapter.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/workflowAdapter.contract.test.mjs` failed initially (`ask workflow` command and workflow snapshot missing).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/workflowAdapter.contract.test.mjs` passed (2/2).
  - `cmd /c npm run ask:verify:phase3` passed (phase contracts 2/2 + repo tests 20/20).
- Task 5 RED/GREEN evidence + verify runtime implemented:
  - Added `VerificationRuntime`.
  - Added CLI commands `ask evidence attach` and `ask verify pass|fail`.
  - Extended `EvidenceRecorder` with replay-derived verification snapshot readers.
  - Added `ask-core/tests/evidenceVerify.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/evidenceVerify.contract.test.mjs` failed initially (`ask evidence` / `ask verify` command surface missing).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/evidenceVerify.contract.test.mjs` passed (2/2).
  - `cmd /c npm run ask:verify:phase2` passed (phase contracts 4/4 + repo tests 20/20).
- Task 4 RED/GREEN task runtime implemented:
  - Added `TaskRuntime` core runtime.
  - Added task invariants at `runtime/invariants/taskInvariants.js`.
  - Added `ask task create|assign|start|status` CLI command.
  - Added `ask-core/tests/taskRuntime.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/taskRuntime.contract.test.mjs` failed initially (`ask task` command missing).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/taskRuntime.contract.test.mjs` passed (2/2).
  - `cmd /c npm run ask:verify:phase2` passed (phase contracts 2/2 + repo tests 20/20).
- Task 3 RED/GREEN session-event bridge implemented:
  - Added event-first bridge behavior in `SessionRuntime`, `HandoffEngine`, and `WorkContextEngine`.
  - Added `ask-core/tests/sessionEventBridge.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/sessionEventBridge.contract.test.mjs` failed initially (missing session/handoff/context event records).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/sessionEventBridge.contract.test.mjs` passed (3/3).
  - `cmd /c node --test ask-core/tests/sessionEventBridge.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs` passed (8/8).
  - `cmd /c npm run ask:verify:phase1` passed (phase contracts 8/8 + repo tests 20/20).
- Task 2 RED/GREEN replay runtime implemented:
  - Added `RuntimeSnapshotStore` and `RuntimeProjectionEngine`.
  - Added core projectors: `SessionProjector`, `TaskBoardProjector`, `VerificationProjector`.
  - Added `ask replay` command.
  - Added `ask-core/tests/replayProjection.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/replayProjection.contract.test.mjs` failed initially (`ERR_MODULE_NOT_FOUND` for `RuntimeProjectionEngine`).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/replayProjection.contract.test.mjs` passed (2/2).
  - `cmd /c npm run ask:verify:phase1` passed (phase contracts 5/5 + repo tests 20/20).
- Task 1 RED/GREEN foundation implemented:
  - Added `SequenceStore` and `EventLedger` runtime modules.
  - Extended `AskPaths` with runtime event/snapshot/task path helpers.
  - Extended `FileStore` with `appendLine`, `readLines`, `exists`.
  - Extended `Scaffolder` to initialize event ledger files (`events.ndjson`, `sequence.json`) and runtime snapshots.
  - Added `ask-core/tests/eventLedger.foundation.contract.test.mjs`.
- RED verification:
  - `cmd /c node --test ask-core/tests/eventLedger.foundation.contract.test.mjs` failed initially (`ERR_MODULE_NOT_FOUND` for `SequenceStore`).
- GREEN verification:
  - `cmd /c node --test ask-core/tests/eventLedger.foundation.contract.test.mjs` passed (3/3).
  - `cmd /c node --test ask-core/tests/eventLedger.foundation.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs` passed (5/5).
- Added phase-based autonomy verification runner:
  - `scripts/autonomy/runPhaseVerification.mjs`
  - `npm` scripts: `ask:verify:baseline`, `ask:verify:phase1..phase6`
- Added operator guidance for autonomous execution:
  - `docs/autonomy-mode.md`
  - linked from `README.md`
- Validated autonomy runner execution path:
  - `cmd /c npm run ask:verify:baseline` passed.
- Produced ASK 3.0 implementation roadmap at:
  - `docs/plans/2026-03-14-ask-3-runtime-evolution-implementation.md`
- Mapped current ASK 2.0 capabilities to ASK 3.0 target layers:
  - event ledger + replay/projectors
  - task/workflow runtime
  - freshness/integration orchestration
  - routing/claims/child sessions
  - policy packs and delivery governance
- Added explicit enterprise integration guardrails for external `obra/superpowers`:
  - version pinning policy
  - skill allowlist
  - compatibility harness
  - kill-switch + deterministic fallback

## Next Tasks

1. Add downstream migration note for repos missing `branchEnforcementMode` in `active-work-context.json`.
2. Execute ASK 3.0 Task 12: docs, installer surface, and release-gating updates.
3. Keep bridge migration discipline until replay-derived snapshots are stable.

Task board source of truth: `docs/session/tasks.md`.

## Blockers / Risks

- ASK 3.0 scope is broad; strict phase gates are required to avoid partial cutovers.
- Superpowers integration must stay adapter-boundary only (no coupling to upstream internals).

## Verification Baseline (latest run)

- `cmd /c node --test ask-core/tests/deliveryGovernance.contract.test.mjs` (pass, 4/4)
- `node --test <explicit ask-core test file list>` (pass 65/68, known pre-existing guarded-command contract failures in `guardedCommandRunner.contract.test.mjs`)

Latest status: `Task 11 release trains + promotion gates + rollout policies pass (2026-03-14)`.

## Resume Commands

```powershell
git checkout ask-3-phase1-event-ledger
git log -5 --oneline
cmd /c npm run ask:verify:phase3
cmd /c npm run ask:verify:phase4
cmd /c npm run ask:verify:phase5
```
