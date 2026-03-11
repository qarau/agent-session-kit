# Current Status

Last updated: 2026-03-12

## Branch and Head

- Active branch: `ask-runtime`
- Current HEAD: `02343c5 docs: align bootstrap and lifecycle runtime guidance`

## Active Objective

Complete phase-2 ask-core lifecycle depth with transactional session journal/recovery and CLI transition contracts.

## Completed In This Stream

- `5512f6d` add lifecycle transition contracts.
- `bd1417e` add session journal storage primitives.
- `31af39b` implement lifecycle transitions and session CLI contracts.
- `6d9a54f` add lifecycle recovery and legacy migration behavior.
- `02343c5` align bootstrap templates and docs with lifecycle runtime.

## Next Tasks

1. Request implementation review for phase-2 lifecycle depth changes.
2. Decide phase-2 integration path to `main` release branch.
3. Define final adapter-to-core cutover parity gate for legacy removal.

Task board source of truth: `docs/session/tasks.md`.

## Blockers / Risks

- Adapter flow still executes legacy ASK checks plus ask-core contracts; full cutover remains pending parity-gate agreement.
- Recovery logic currently finalizes only when pending event exists in journal; unresolved pending markers still need maintainer policy handling.
- `.ask/*` runtime state is intentionally local and ignored; accidental staging must remain blocked by policy.

## Verification Baseline (latest run)

- `cmd /c npm run test` (pass)
- `cmd /c node --test ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs` (pass)
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
