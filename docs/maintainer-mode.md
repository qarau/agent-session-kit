# ASK Maintainer Mode

This mode is for teams maintaining ASK itself.

## Branch Policy

- `main/release*` uses fail-closed enforcement.
- Feature branches use advisory enforcement.
- Protected branch failures must be fixed before commit/push.

## Tracked vs Local Data

- Tracked governance docs live in `docs/session/*` and `docs/releases/*`.
- `docs/ASK_Runtime/*` is local-only scratch/runtime data and must never be committed.
- `ask-core/` is tracked and is the standalone runtime target; maintain adapter parity while migration is in progress.

## Adapter Migration Guard

- `pre-commit` and `pre-push` hooks should route through the ask-core adapter wrappers (`scripts/session/runAskCorePreCommitAdapter.mjs` and `scripts/session/runAskCorePrePushAdapter.mjs`).
- `pre-commit` is now ask-core-only via `ask pre-commit-check`; `pre-push` remains hybrid until full cutover.
- Adapter behavior must stay policy-equivalent with existing ASK script expectations until full runtime cutover.
- Session lifecycle recovery relies on `.ask/sessions/pending-transition.json`; maintainers should treat stale pending markers as recovery signals, not noise.

## Required Maintainer Signals

- Keep `docs/session/current-status.md` and `docs/session/change-log.md` current for meaningful work.
- Keep release ledger, `latest.md`, and release notes aligned.
- Keep entries concise and team-readable.
- Keep lifecycle policy keys explicit in runtime policy:
  - `allowed_preflight_states`
  - `allowed_can_commit_states`
  - default intent is `active,paused` allowed while `blocked,closed` are rejected for commit-readiness flows.

## Verification Flow

Run before protected-branch push:

```bash
npm run test
node scripts/verifyReleaseDocsConsistency.mjs --root .
node kit/scripts/session/verifySessionDocsFreshness.mjs --mode preflight --config docs/session/active-work-context.json
```

Record verification evidence in `docs/session/change-log.md` with exact commands and result status.
