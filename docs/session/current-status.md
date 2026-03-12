# Current Status

Last updated: 2026-03-12

## Branch and Head

- Active branch: `ask-hard-cutover`
- Current HEAD: `186c61a docs: publish ask-core-only runtime guidance`

## Active Objective

Complete hard-cutover verification evidence capture and prepare integration of ask-core-only runtime changes.

## Completed In This Stream

- `8dc109f` add pre-push-check hard-cutover contracts.
- `d77d652` add ask-core `pre-push-check` contract and release-doc engine.
- `d8c4748` cut pre-push adapter to ask-core `pre-push-check`.
- `1c6bd84` cut installer payload to ask-core-only runtime.
- `38fec70` centralize branch enforcement mode in ask-core runtime/tests.
- `186c61a` publish ask-core-only runtime docs and maintainer guidance.

## Next Tasks

1. Request implementation review for hard-cutover branch.
2. Choose release integration path to `main`.
3. Resolve remaining governance open loops for pending markers and lifecycle override policy.

Task board source of truth: `docs/session/tasks.md`.

## Blockers / Risks

- Pending marker escalation policy remains undecided for unmatched `.ask/sessions/pending-transition.json`.
- Lifecycle override governance is still open for non-default `allowed_preflight_states` / `allowed_can_commit_states`.
- `.ask/*` runtime state remains local-only and must continue to be blocked from staging.

## Verification Baseline (latest run)

- `cmd /c npm run test` (pass)
- `cmd /c node --test ask-core/tests/preCommitCheck.contract.test.mjs ask-core/tests/prePushCheck.contract.test.mjs ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/policyLifecycleStates.contract.test.mjs ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs` (pass)
- `cmd /c node --test tests/askCoreAdapterMigration.test.mjs tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs` (pass)
- `cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs` (pass)
- `cmd /c node scripts/session/runAskCorePrePushAdapter.mjs` (pass)

Latest status: `pass (2026-03-12)`.

## Resume Commands

```powershell
git checkout ask-hard-cutover
git log -8 --oneline
cmd /c npm run test
```
