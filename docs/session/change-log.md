# Session Change Log

## 2026-03-11

- Maintainer governance rollout:
  - Files:
    - `kit/scripts/session/resolveBranchEnforcementMode.mjs`
    - `kit/scripts/session/verifySessionDocsFreshness.mjs`
    - `kit/scripts/session/verifyReleaseDocsConsistency.mjs`
    - `kit/scripts/session/releaseDocsConsistencyCore.mjs`
    - `scripts/verifyReleaseDocsConsistency.mjs`
    - `kit/.githooks/pre-push`
  - Behavior:
    - Added branch-aware policy (`main`/`release/*` enforce, feature branches advisory).
    - Added hard rejection for staged `docs/ASK_Runtime/*` runtime artifacts.
    - Added release-doc consistency check into session pre-push flow.
  - Verification:
    - `npm run test` passed.
    - `node scripts/verifyReleaseDocsConsistency.mjs --root .` passed.
    - `node kit/scripts/session/verifySessionDocsFreshness.mjs --mode preflight --config docs/session/active-work-context.json` passed.
    - `node kit/scripts/session/verifyWorkContext.mjs --mode preflight --config docs/session/active-work-context.json` passed with temporary repo lock.
    - `node kit/scripts/session/verifySessionDocsFreshness.mjs --mode pre-commit --config docs/session/active-work-context.json` failed as expected when `docs/ASK_Runtime/policy-test.txt` was staged.

- Maintainer repo dogfooding and docs updates:
  - Files:
    - `.githooks/pre-commit`
    - `.githooks/pre-push`
    - `.githooks/post-commit`
    - `docs/session/*`
    - `docs/maintainer-mode.md`
    - `README.md`
    - `docs/adoption-guide.md`
    - `docs/repo-boundary-guards.md`
    - `docs/releases/release-checklist.md`
  - Behavior:
    - Added root-level dogfooding hooks/docs for ASK self-development.
    - Documented branch-aware maintainer policy and verification evidence expectations.
