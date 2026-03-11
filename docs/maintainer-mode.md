# ASK Maintainer Mode

This mode is for teams maintaining ASK itself.

## Branch Policy

- `main/release*` uses fail-closed enforcement.
- Feature branches use advisory enforcement.
- Protected branch failures must be fixed before commit/push.

## Tracked vs Local Data

- Tracked governance docs live in `docs/session/*` and `docs/releases/*`.
- `docs/ASK_Runtime/*` is local-only scratch/runtime data and must never be committed.

## Required Maintainer Signals

- Keep `docs/session/current-status.md` and `docs/session/change-log.md` current for meaningful work.
- Keep release ledger, `latest.md`, and release notes aligned.
- Keep entries concise and team-readable.

## Verification Flow

Run before protected-branch push:

```bash
npm run test
node scripts/verifyReleaseDocsConsistency.mjs --root .
node kit/scripts/session/verifySessionDocsFreshness.mjs --mode preflight --config docs/session/active-work-context.json
```

Record verification evidence in `docs/session/change-log.md` with exact commands and result status.
