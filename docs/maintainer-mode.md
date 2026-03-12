# ASK Maintainer Mode

This mode is for teams maintaining ASK itself.

## Branch Policy

- `main/release*` uses fail-closed enforcement.
- Feature branches use advisory enforcement.
- Protected branch failures must be fixed before commit/push.

## Tracked vs Local Data

- Tracked governance docs live in `docs/session/*` and `docs/releases/*`.
- `docs/ASK_Runtime/*` is local-only scratch/runtime data and must never be committed.
- `ask-core/` is tracked and is the standalone runtime target for governance checks.

## Runtime Guard

- `pre-commit` and `pre-push` hooks should route through the ask-core adapter wrappers (`scripts/session/runAskCorePreCommitAdapter.mjs` and `scripts/session/runAskCorePrePushAdapter.mjs`).
- `pre-commit` runs `ask pre-commit-check`; `pre-push` runs `ask pre-push-check`.
- Adapter runtime execution uses guarded stall handling (`180s` wall/no-output timeout, one automatic retry).
- Runtime operation state is recorded at `.ask/runtime/last-operation.json`; use `ask session doctor` for diagnostics.
- Optional Codex context budgeting is available via `ask codex context status|ensure|compact` when `codex_context.enabled=true`.
- Runtime behavior should remain policy-equivalent with ASK governance expectations.
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
node scripts/session/runAskCorePreCommitAdapter.mjs
node scripts/session/runAskCorePrePushAdapter.mjs
node ask-core/bin/ask.js codex context status
node ask-core/bin/ask.js session doctor
```

Record verification evidence in `docs/session/change-log.md` with exact commands and result status.
