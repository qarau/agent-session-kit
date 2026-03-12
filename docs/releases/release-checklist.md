# ASK Release Checklist

Use this checklist before publishing any ASK release docs/tag.

## 1) Confirm Scope State

- [ ] If scope is unreleased, keep it in `vX.Y.Z-draft.md`.
- [ ] If scope is released/tagged, promote docs to `vX.Y.Z.md`.
- [ ] Do not place unreleased scope under an existing released version.

## 2) Update Release Files

- [ ] Update release notes: `vX.Y.Z.md`.
- [ ] Update announcement copy: `vX.Y.Z-announcement.md` (if used).
- [ ] Update `latest.md` to point to the newest released version.
- [ ] Update `README.md` (release ledger) with released and draft mappings.

## 3) Verify Claims

- [ ] Run: `npm --prefix agent-session-kit run test:release-docs`
- [ ] Run: `npm --prefix agent-session-kit run test`
- [ ] Run: `node agent-session-kit/scripts/verifyReleaseDocsConsistency.mjs --root .` (release docs consistency must pass)
- [ ] Run: `node agent-session-kit/scripts/session/runAskCorePrePushAdapter.mjs` (protected branches must pass fail-closed checks)
- [ ] Run: `npm --prefix apps/gumatua-v2 run fast-check` (when release notes reference fast-check/V2 behavior)
- [ ] Ensure verification lines in release docs match commands that were actually run.

## 4) Publish Flow

- [ ] Commit/push branch updates.
- [ ] Publish ASK subtree to `agent-session-kit-github/main`.
- [ ] If releasing new version, create/push tag and GitHub release.

## 5) Session Governance Sync

- [ ] Update `docs/session/current-status.md`.
- [ ] Update `docs/session/tasks.md`.
- [ ] Update `docs/session/change-log.md`.
- [ ] Add a compact verification evidence line in `docs/session/change-log.md` with exact commands and pass/fail outcome.
- [ ] Run: `node agent-session-kit/scripts/session/runAskCorePreCommitAdapter.mjs`.
