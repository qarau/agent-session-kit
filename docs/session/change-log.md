# Session Change Log

## 2026-03-12

- Ask-core phase-2 lifecycle depth implementation:
  - Commits:
    - `5512f6d` add lifecycle transition contracts.
    - `bd1417e` add session journal storage primitives.
    - `31af39b` implement lifecycle transitions and CLI contracts.
    - `6d9a54f` add recovery and legacy snapshot migration.
    - `02343c5` sync bootstrap templates and lifecycle docs.
  - Behavior:
    - Added lifecycle transitions (`start/pause/resume/block/close`) with required `--reason` for mutating commands.
    - Added transactional session persistence via `active-session.json` + `history.ndjson` + `pending-transition.json`.
    - Added recovery path that finalizes snapshot when pending transition is already in history.
    - Added legacy snapshot bootstrap that seeds history lineage before first new transition.
  - Verification:
    - `cmd /c npm run test` passed.
    - `cmd /c node --test ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs` passed.
    - `cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs` passed.
    - `cmd /c node scripts/session/runAskCorePrePushAdapter.mjs` passed.
    - `cmd /c node --test tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs` passed.

## 2026-03-11

- Ask-core phase-1 runtime and adapter migration:
  - Commits:
    - `1143b39` bootstrap standalone runtime package.
    - `10413c5` add session/context runtime contracts.
    - `11069df` add `preflight`/`can-commit` policy contracts.
    - `dbf186b` migrate pre-commit/pre-push through ask-core adapters.
    - `182c158` wire docs and package scripts for ask-core workflow.
  - Runtime proof:
    - Hook entrypoints now route through:
      - `scripts/session/runAskCorePreCommitAdapter.mjs`
      - `scripts/session/runAskCorePrePushAdapter.mjs`
    - Adapter layer preserves current ASK checks while invoking ask-core contracts.
  - Verification:
    - `cmd /c npm run test` passed.
    - `cmd /c node --test ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/preflightCanCommit.contract.test.mjs` passed.
    - `cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs` passed.
    - `cmd /c node scripts/session/runAskCorePrePushAdapter.mjs` passed.

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
