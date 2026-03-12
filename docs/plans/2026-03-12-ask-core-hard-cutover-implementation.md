# ASK Core Hard Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all legacy runtime execution paths and make ask-core the only commit/push governance runtime.

**Architecture:** Add an ask-core `pre-push-check` contract, migrate release-doc and freshness/context checks into ask-core runtime flow, cut pre-push adapter to ask-core-only, and switch installer payload from legacy `kit/scripts/session/*` runtime scripts to ask-core + wrappers + docs templates.

**Tech Stack:** Node.js 20+ ESM, git hooks, ask-core CLI/core modules, Node test runner (`node --test`), installer smoke tests.

---

Execution discipline for every task:
- Use `@superpowers:test-driven-development` (red -> green -> refactor).
- Use `@superpowers:verification-before-completion` before each completion claim.

### Task 1: Add failing pre-push cutover contracts

**Files:**
- Create: `ask-core/tests/prePushCheck.contract.test.mjs`
- Modify: `tests/askCoreAdapterMigration.test.mjs`
- Modify: `tests/askCoreDocs.test.mjs`

**Step 1: Write failing tests**

Add contract tests for:

```js
test('pre-push-check passes in healthy state', ...);
test('pre-push-check fails with deterministic missing entries', ...);
test('pre-push adapter works in temp repo without legacy kit scripts', ...);
```

Extend docs assertions to reject hybrid wording once cutover is done.

**Step 2: Run tests to verify RED**

Run:

```bash
node --test ask-core/tests/prePushCheck.contract.test.mjs tests/askCoreAdapterMigration.test.mjs tests/askCoreDocs.test.mjs
```

Expected: FAIL (`pre-push-check` missing + pre-push adapter still legacy-dependent + docs still hybrid).

**Step 3: Commit failing tests**

```bash
git add ask-core/tests/prePushCheck.contract.test.mjs tests/askCoreAdapterMigration.test.mjs tests/askCoreDocs.test.mjs
git commit -m "test: add pre-push-check hard-cutover contracts"
```

### Task 2: Implement ask-core `pre-push-check` and release-doc core

**Files:**
- Create: `ask-core/src/cli/commands/prePushCheck.js`
- Create: `ask-core/src/core/PrePushCheckEngine.js`
- Create: `ask-core/src/core/ReleaseDocsConsistencyEngine.js`
- Modify: `ask-core/src/cli/index.js`
- Modify: `ask-core/src/core/PolicyEngine.js` (only if parser reuse is needed)

**Step 1: Verify RED on command contracts**

```bash
node --test ask-core/tests/prePushCheck.contract.test.mjs
```

Expected: FAIL.

**Step 2: Implement minimal runtime**

`ask pre-push-check` should aggregate:
- work-context parity
- docs freshness in pre-push mode (outgoing range)
- release-doc consistency
- lifecycle policy gates (`preflight` / `can-commit`)

Output contract:

```json
{
  "passed": false,
  "missing": ["..."],
  "checks": ["work-context", "docs-freshness", "release-docs", "session-preflight", "session-can-commit"]
}
```

Failure sets `process.exitCode = 1`.

**Step 3: Re-run tests for GREEN**

```bash
node --test ask-core/tests/prePushCheck.contract.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add ask-core/src/cli/commands/prePushCheck.js ask-core/src/core/PrePushCheckEngine.js ask-core/src/core/ReleaseDocsConsistencyEngine.js ask-core/src/cli/index.js ask-core/src/core/PolicyEngine.js
git commit -m "feat: add ask-core pre-push-check contract and release-doc engine"
```

### Task 3: Cut pre-push adapter to ask-core-only execution

**Files:**
- Modify: `ask-core/src/adapters/sessionKit/runPrePushAdapter.js`
- Modify: `scripts/session/runAskCorePrePushAdapter.mjs` (if wrapper behavior/logging changes)
- Modify: `.githooks/pre-push` (only if invocation semantics change)
- Modify: `tests/askCoreAdapterMigration.test.mjs`

**Step 1: Verify RED**

```bash
node --test tests/askCoreAdapterMigration.test.mjs
```

Expected: FAIL for temp-repo pre-push without legacy scripts.

**Step 2: Implement minimal adapter cutover**

Remove direct calls to:
- `kit/scripts/session/verifyWorkContext.mjs`
- `kit/scripts/session/verifySessionDocsFreshness.mjs`
- `kit/scripts/session/verifyReleaseDocsConsistency.mjs`

Replace with:

```js
runOrThrow(process.execPath, [askBinPath, 'pre-push-check'], cwd);
```

**Step 3: Re-run tests**

```bash
node --test tests/askCoreAdapterMigration.test.mjs ask-core/tests/prePushCheck.contract.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add ask-core/src/adapters/sessionKit/runPrePushAdapter.js scripts/session/runAskCorePrePushAdapter.mjs .githooks/pre-push tests/askCoreAdapterMigration.test.mjs
git commit -m "feat: cut over pre-push adapter to ask-core pre-push-check"
```

### Task 4: Installer payload hard cutover (no legacy runtime scripts)

**Files:**
- Modify: `install-session-kit.mjs`
- Modify: `tests/sessionKitSmoke.test.mjs`
- Modify: `kit/docs/session/*` templates as needed
- Delete: `kit/scripts/session/verifyWorkContext.mjs`
- Delete: `kit/scripts/session/verifySessionDocsFreshness.mjs`
- Delete: `kit/scripts/session/verifyReleaseDocsConsistency.mjs`
- Delete: `kit/scripts/session/releaseDocsConsistencyCore.mjs`
- Delete: `kit/scripts/session/resolveBranchEnforcementMode.mjs`
- Delete: `kit/.githooks/pre-commit`
- Delete: `kit/.githooks/pre-push`

**Step 1: Write failing installer smoke assertions**

Update smoke tests to assert installed repo runtime is ask-core-based (hooks -> wrappers -> ask-core checks) and does not require legacy validator files.

**Step 2: Run RED**

```bash
node --test tests/sessionKitSmoke.test.mjs
```

Expected: FAIL until installer + payload are updated.

**Step 3: Implement installer cutover**

Installer should copy:
- ask-core runtime package (`ask-core/**`)
- wrapper scripts (`scripts/session/runAskCorePreCommitAdapter.mjs`, `scripts/session/runAskCorePrePushAdapter.mjs`)
- hook templates using wrappers
- `docs/session/*` starter templates

No installed runtime dependency on `kit/scripts/session/*`.

**Step 4: Run GREEN**

```bash
node --test tests/sessionKitSmoke.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add install-session-kit.mjs tests/sessionKitSmoke.test.mjs kit/docs/session
git add -u kit/scripts/session kit/.githooks
git commit -m "feat: cut installer payload to ask-core-only runtime"
```

### Task 5: Docs and governance de-legacy cleanup

**Files:**
- Modify: `README.md`
- Modify: `docs/how-it-works.md`
- Modify: `docs/maintainer-mode.md`
- Modify: `docs/adoption-guide.md`
- Modify: `docs/release-checklist.md`
- Modify: `tests/askCoreDocs.test.mjs`
- Modify: `tests/releaseDocsConsistency.test.mjs` (if import path changed)
- Modify: `scripts/verifyReleaseDocsConsistency.mjs`

**Step 1: Add/adjust failing docs assertions**

Assert ask-core-only wording:
- no hybrid statement for pre-push
- no `kit/scripts/session/*` runtime instructions

**Step 2: Run RED**

```bash
node --test tests/askCoreDocs.test.mjs tests/releaseDocsConsistency.test.mjs
```

Expected: FAIL.

**Step 3: Implement doc/script updates**

Route release-doc verification helper to ask-core core module/command.
Update docs to canonical ask-core-only operational flow.

**Step 4: Run GREEN**

```bash
node --test tests/askCoreDocs.test.mjs tests/releaseDocsConsistency.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add README.md docs/how-it-works.md docs/maintainer-mode.md docs/adoption-guide.md docs/release-checklist.md tests/askCoreDocs.test.mjs tests/releaseDocsConsistency.test.mjs scripts/verifyReleaseDocsConsistency.mjs
git commit -m "docs: publish ask-core-only runtime guidance"
```

### Task 6: Full verification and session evidence

**Files:**
- Modify: `docs/session/current-status.md`
- Modify: `docs/session/tasks.md`
- Modify: `docs/session/change-log.md`
- Modify: `docs/session/open-loops.md`

**Step 1: Run full verification**

```bash
cmd /c npm run test
cmd /c node --test ask-core/tests/preCommitCheck.contract.test.mjs ask-core/tests/prePushCheck.contract.test.mjs ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/policyLifecycleStates.contract.test.mjs ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs
cmd /c node --test tests/askCoreAdapterMigration.test.mjs tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs
cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs
cmd /c node scripts/session/runAskCorePrePushAdapter.mjs
```

Expected: all PASS.

**Step 2: Record evidence**

Update session docs with:
- hard-cutover completion state
- exact commands + pass results
- note that hybrid mode is removed (close related open loop)

**Step 3: Commit**

```bash
git add docs/session/current-status.md docs/session/tasks.md docs/session/change-log.md docs/session/open-loops.md
git commit -m "chore: record ask-core hard cutover verification evidence"
```

