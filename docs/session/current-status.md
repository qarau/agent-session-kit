# Current Status

Last updated: 2026-03-14

## Branch and Head

- Active branch: `ask-3-phase1-event-ledger`
- Current HEAD: `460c4b7 feat: add event-driven evidence and verification commands`

## Active Objective

Execute ASK 3.0 Task 6 (workflow adapter integration) using TDD in isolated worktree flow.

## Completed In This Stream

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

1. Execute Task 6A: enterprise guardrails for superpowers integration.
2. Add `superpowersEnterprise` contracts (RED), then implement version/allowlist/compatibility/kill-switch policy layer (GREEN).
3. Keep bridge migration discipline until replay-derived snapshots are stable.

Task board source of truth: `docs/session/tasks.md`.

## Blockers / Risks

- ASK 3.0 scope is broad; strict phase gates are required to avoid partial cutovers.
- Superpowers integration must stay adapter-boundary only (no coupling to upstream internals).

## Verification Baseline (latest run)

- `cmd /c node --test ask-core/tests/workflowAdapter.contract.test.mjs` (pass, 2/2)
- `cmd /c npm run ask:verify:phase3` (pass, phase 2/2 + repo 20/20)

Latest status: `Task 6 workflow adapter runtime pass (2026-03-14)`.

## Resume Commands

```powershell
git checkout ask-3-phase1-event-ledger
git log -5 --oneline
cmd /c npm run ask:verify:phase3
```
