# Current Status

Last updated: 2026-03-12

## Branch and Head

- Active branch: `ask-hard-cutover`
- Current HEAD: `d8fd57b feat: add ask session doctor for runtime stall diagnostics`

## Active Objective

Complete runtime stall-recovery hardening and verification before merging hard-cutover work.

## Completed In This Stream

- `8dc109f` add pre-push-check hard-cutover contracts.
- `d77d652` add ask-core `pre-push-check` contract and release-doc engine.
- `d8c4748` cut pre-push adapter to ask-core `pre-push-check`.
- `1c6bd84` cut installer payload to ask-core-only runtime.
- `38fec70` centralize branch enforcement mode in ask-core runtime/tests.
- `186c61a` publish ask-core-only runtime docs and maintainer guidance.
- `9e2fb05` add guarded command runner stall-recovery contracts.
- `9ea1a5b` add guarded runner + runtime operation state tracking.
- `4aac026` wire pre-commit/pre-push adapters through guarded runtime execution.
- `d8fd57b` add `ask session doctor` runtime diagnostics command.

## Next Tasks

1. Request implementation review for hard-cutover branch.
2. Choose release integration path to `main`.
3. Resolve remaining governance open loops for pending markers and lifecycle override policy.

Task board source of truth: `docs/session/tasks.md`.

## Blockers / Risks

- Pending marker escalation policy remains undecided for unmatched `.ask/sessions/pending-transition.json`.
- Lifecycle override governance is still open for non-default `allowed_preflight_states` / `allowed_can_commit_states`.
- `.ask/*` runtime state remains local-only and must continue to be blocked from staging.
- Runtime stall handling now retries once, but maintainers still need explicit policy for unmatched pending markers.

## Verification Baseline (latest run)

- `cmd /c npm run test` (pass)
- `cmd /c node --test ask-core/tests/preCommitCheck.contract.test.mjs ask-core/tests/prePushCheck.contract.test.mjs ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/policyLifecycleStates.contract.test.mjs ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs` (pass)
- `cmd /c node --test ask-core/tests/guardedCommandRunner.contract.test.mjs ask-core/tests/sessionDoctor.contract.test.mjs ask-core/tests/preCommitCheck.contract.test.mjs ask-core/tests/prePushCheck.contract.test.mjs` (pass)
- `cmd /c node --test tests/askCoreAdapterMigration.test.mjs tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs` (pass)
- `cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs` (pass)
- `cmd /c node scripts/session/runAskCorePrePushAdapter.mjs` (pass)
- `cmd /c node ask-core/bin/ask.js session doctor` (pass)

Latest status: `pass (2026-03-12)`.

## Resume Commands

```powershell
git checkout ask-hard-cutover
git log -8 --oneline
cmd /c npm run test
```
