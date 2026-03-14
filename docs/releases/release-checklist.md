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

- [ ] Run: `npm run test:release-docs`
- [ ] Run: `npm run test`
- [ ] Run: `node scripts/verifyReleaseDocsConsistency.mjs --root .` (release docs consistency must pass)
- [ ] Run: `node scripts/session/runAskCorePrePushAdapter.mjs` (protected branches must pass fail-closed checks)
- [ ] Ensure verification lines in release docs match commands that were actually run.

## 4) Publish Flow

- [ ] Commit/push branch updates.
- [ ] If releasing new version, create/push tag and publish GitHub release.

## 5) Session Governance Sync

- [ ] Update `docs/session/current-status.md`.
- [ ] Update `docs/session/tasks.md`.
- [ ] Update `docs/session/change-log.md`.
- [ ] Add a compact verification evidence line in `docs/session/change-log.md` with exact commands and pass/fail outcome.
- [ ] Run: `node scripts/session/runAskCorePreCommitAdapter.mjs`.
