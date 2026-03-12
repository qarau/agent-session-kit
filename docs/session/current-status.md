# Current Status

Last updated: 2026-03-12

## Branch and Head

- Active branch: `ask-runtime`
- Current HEAD: `d9bee48 docs: add lifecycle policy integration guidance`

## Active Objective

Complete phase-3 lifecycle-policy integration so `preflight` and `can-commit` are lifecycle-state aware.

## Completed In This Stream

- `3c605ff` add lifecycle-state matrix contracts for `preflight`/`can-commit`.
- `a3251da` add lifecycle allowed-state policy defaults and parsing.
- `40dc299` enforce lifecycle allowed states in `preflight`.
- `b7b014e` enforce lifecycle allowed states in `can-commit`.
- `d9bee48` add lifecycle-policy integration docs and regression assertions.

## Next Tasks

1. Request implementation review for phase-3 lifecycle-policy integration changes.
2. Decide phase-3 integration path to `main` release branch.
3. Define phase-4 cutover work to reduce legacy dual-path checks in adapters.

Task board source of truth: `docs/session/tasks.md`.

## Blockers / Risks

- Adapter flow still executes legacy ASK checks plus ask-core contracts; full cutover remains pending parity-gate agreement.
- Recovery logic finalizes only when pending event exists in journal; unresolved pending markers still require explicit maintainer policy handling.
- Lifecycle policy defaults are now explicit; divergence risk exists if downstream repos override allowed states without team agreement.
- `.ask/*` runtime state is intentionally local and ignored; accidental staging must remain blocked by policy.

## Verification Baseline (latest run)

- `cmd /c npm run test` (pass)
- `cmd /c node --test ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/policyLifecycleStates.contract.test.mjs ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs` (pass)
- `cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs` (pass)
- `cmd /c node scripts/session/runAskCorePrePushAdapter.mjs` (pass)
- `cmd /c node --test tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs` (pass)

Latest status: `pass (2026-03-12)`.

## Resume Commands

```powershell
git checkout ask-runtime
git log -5 --oneline
cmd /c npm run test
```
