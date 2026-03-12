# Current Status

Last updated: 2026-03-13

## Branch and Head

- Active branch: `main`
- Current HEAD: `b572331 docs: reduce redundancy and centralize runtime documentation`

## Active Objective

Add a project-vs-maintainer governance mode switch so ASK pre-push works cleanly for downstream repos while preserving maintainer release-doc enforcement.

## Completed In This Stream

- Added `governanceMode` handling in pre-push runtime (`project` vs `maintainer`).
- Set installer template default to `governanceMode: "project"` in `kit/docs/session/active-work-context.json`.
- Set this repo to `governanceMode: "maintainer"` for maintainer strictness.
- Added contract tests for project-mode pre-push behavior and updated docs/smoke expectations.
- Reduced doc overlap while clarifying mode semantics in `how-it-works`, `adoption-guide`, and `maintainer-mode`.

## Next Tasks

1. Commit and push governance mode implementation.
2. Optionally add a short migration note for existing downstream installs without `governanceMode`.
3. Decide if `ASK_GOVERNANCE_MODE` should be documented as a temporary CI/session override.

Task board source of truth: `docs/session/tasks.md`.

## Blockers / Risks

- Existing downstream repos that already installed older templates may still be in maintainer-like behavior until they add `governanceMode: "project"`.

## Verification Baseline (latest run)

- `cmd /c node --test ask-core/tests/prePushCheck.contract.test.mjs tests/releaseDocsBranchMode.test.mjs tests/sessionKitSmoke.test.mjs` (pass)
- `cmd /c npm run test` (pass)
- `cmd /c npm run test:release-docs` (pass)
- `node --test <all ask-core test files>` via explicit file list (pass, 32/32)

Latest status: `pass (2026-03-13)`.

## Resume Commands

```powershell
git checkout main
git log -5 --oneline
cmd /c npm run test
```
