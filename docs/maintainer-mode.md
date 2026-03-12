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
- Maintainer repos should set `governanceMode: "maintainer"` in `docs/session/active-work-context.json`.

## Runtime Guard

- Hooks must route through the ask-core adapter wrappers (`scripts/session/runAskCorePreCommitAdapter.mjs` and `scripts/session/runAskCorePrePushAdapter.mjs`).
- Runtime command behavior, stall handling, and codex context flow are documented in `how-it-works.md`.
- In maintainer mode, pre-push includes release-doc consistency checks on protected branches.
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

Before protected-branch push, run release discipline from `docs/releases/release-checklist.md`.
Then run maintainer-specific runtime diagnostics:

```bash
node ask-core/bin/ask.js session doctor
```

If `codex_context.enabled=true`, also run:

```bash
node ask-core/bin/ask.js codex context status
```

Record verification evidence in `docs/session/change-log.md` with exact commands and result status.
