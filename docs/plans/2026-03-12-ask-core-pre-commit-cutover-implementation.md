# ASK Core Pre-Commit Cutover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cut pre-commit adapter flow to ask-core-only execution with strict parity checks (work-context + docs freshness + lifecycle preflight/can-commit) while keeping pre-push hybrid.

**Architecture:** Introduce a single `ask pre-commit-check` contract that aggregates parity checks with deterministic output and exit behavior. Replace legacy pre-commit script invocations in adapter with this command. Keep pre-push path unchanged for staged rollout.

**Tech Stack:** Node.js 20+ ESM, `node --test`, git hook adapters, ask-core CLI/runtime policy/session engine.

---

Execution discipline for every task:
- Use `@superpowers:test-driven-development` (red -> green -> refactor).
- Use `@superpowers:verification-before-completion` before each completion claim.

### Task 1: Add failing `pre-commit-check` contract tests and adapter cutover regression

**Files:**
- Create: `ask-core/tests/preCommitCheck.contract.test.mjs`
- Modify: `tests/askCoreAdapterMigration.test.mjs`

**Step 1: Write failing tests**

```js
test('ask pre-commit-check returns passed=true in healthy pre-commit state', () => {
  // setup repo with docs/session/active-work-context.json
  // run ask pre-commit-check
  // expect status 0 and checks[] includes work-context/docs-freshness/session-preflight/session-can-commit
});

test('ask pre-commit-check fails with deterministic missing entries', () => {
  // create mismatch conditions (wrong branch or missing docs freshness)
  // expect status 1 and stable missing strings
});

test('pre-commit adapter works in temp repo without kit/scripts/session legacy files', () => {
  // run adapter against temp repo that has ask-core state but no kit scripts
  // currently fails because legacy script calls remain
});
```

**Step 2: Run tests to verify failure**

Run: `node --test ask-core/tests/preCommitCheck.contract.test.mjs tests/askCoreAdapterMigration.test.mjs`  
Expected: FAIL because command/adapter behavior does not exist yet.

**Step 3: Refine test fixtures only**

Keep fixtures deterministic (temp git repo setup, controlled session/evidence/context writes). Do not add production logic.

**Step 4: Re-run tests**

Run: `node --test ask-core/tests/preCommitCheck.contract.test.mjs tests/askCoreAdapterMigration.test.mjs`  
Expected: still FAIL for missing implementation.

**Step 5: Commit**

```bash
git add ask-core/tests/preCommitCheck.contract.test.mjs tests/askCoreAdapterMigration.test.mjs
git commit -m "test: add pre-commit-check and adapter cutover contracts"
```

### Task 2: Implement ask-core `pre-commit-check` command and runtime parity checks

**Files:**
- Create: `ask-core/src/cli/commands/preCommitCheck.js`
- Create: `ask-core/src/core/PreCommitCheckEngine.js`
- Modify: `ask-core/src/cli/index.js`
- Modify: `ask-core/src/core/SessionRuntime.js` (only if helper access is needed)
- Modify: `ask-core/src/core/WorkContextEngine.js` (only if reusable context helpers are needed)

**Step 1: Run failing command contract tests**

Run: `node --test ask-core/tests/preCommitCheck.contract.test.mjs`  
Expected: FAIL.

**Step 2: Write minimal implementation**

`pre-commit-check` should:
- evaluate work-context parity from `docs/session/active-work-context.json` and repo lock values;
- evaluate docs freshness using staged files (`git diff --cached --name-only --diff-filter=ACMRT`) with existing meaningful-change rules;
- invoke ask-core lifecycle-aware `preflight` and `can-commit` checks via runtime APIs or shared logic;
- print deterministic JSON:

```json
{
  "passed": false,
  "missing": ["..."],
  "checks": ["work-context", "docs-freshness", "session-preflight", "session-can-commit"]
}
```

and set `process.exitCode = 1` on failure.

**Step 3: Re-run tests**

Run: `node --test ask-core/tests/preCommitCheck.contract.test.mjs`  
Expected: PASS.

**Step 4: Commit**

```bash
git add ask-core/src/cli/commands/preCommitCheck.js ask-core/src/core/PreCommitCheckEngine.js ask-core/src/cli/index.js ask-core/src/core/SessionRuntime.js ask-core/src/core/WorkContextEngine.js
git commit -m "feat: add ask-core pre-commit-check contract command"
```

### Task 3: Cut over pre-commit adapter to ask-core-only path

**Files:**
- Modify: `ask-core/src/adapters/sessionKit/runPreCommitAdapter.js`
- Modify: `scripts/session/runAskCorePreCommitAdapter.mjs` (only if wrapper args/logging change)
- Modify: `.githooks/pre-commit` (only if invocation semantics change)
- Modify: `tests/askCoreAdapterMigration.test.mjs`

**Step 1: Run failing adapter cutover test**

Run: `node --test tests/askCoreAdapterMigration.test.mjs`  
Expected: FAIL until legacy calls are removed.

**Step 2: Write minimal implementation**

In pre-commit adapter:
- keep ask-core initialization/session/context setup as needed;
- remove direct legacy script invocations:
  - `kit/scripts/session/verifyWorkContext.mjs`
  - `kit/scripts/session/verifySessionDocsFreshness.mjs`
- call only:

```js
runOrThrow(process.execPath, [askBinPath, 'pre-commit-check'], cwd);
```

Keep pre-push adapter unchanged.

**Step 3: Re-run tests**

Run: `node --test tests/askCoreAdapterMigration.test.mjs ask-core/tests/preCommitCheck.contract.test.mjs`  
Expected: PASS.

**Step 4: Commit**

```bash
git add ask-core/src/adapters/sessionKit/runPreCommitAdapter.js scripts/session/runAskCorePreCommitAdapter.mjs .githooks/pre-commit tests/askCoreAdapterMigration.test.mjs
git commit -m "feat: cut over pre-commit adapter to ask-core pre-commit-check"
```

### Task 4: Sync bootstrap templates and lifecycle docs for phase-4 status

**Files:**
- Modify: `scripts/bootstrapAskCore.cjs`
- Modify: `ask-core/README.md`
- Modify: `README.md`
- Modify: `docs/how-it-works.md`
- Modify: `docs/maintainer-mode.md`
- Modify: `tests/askCoreDocs.test.mjs`

**Step 1: Add failing docs/bootstrap assertions**

```js
test('docs mention ask pre-commit-check and staged pre-push hybrid status', () => {
  // assert command mention + pre-commit cutover + pre-push hybrid note
});
```

If needed, extend bootstrap tests to ensure generated CLI includes `pre-commit-check`.

**Step 2: Run tests to verify failure**

Run: `node --test tests/askCoreDocs.test.mjs tests/askCoreBootstrap.test.mjs`  
Expected: FAIL until templates/docs are updated.

**Step 3: Write minimal implementation**

Update templates/docs to reflect:
- new command `ask pre-commit-check`;
- pre-commit ask-core-only strict parity;
- pre-push still hybrid.

**Step 4: Re-run tests**

Run: `node --test tests/askCoreDocs.test.mjs tests/askCoreBootstrap.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/bootstrapAskCore.cjs ask-core/README.md README.md docs/how-it-works.md docs/maintainer-mode.md tests/askCoreDocs.test.mjs tests/askCoreBootstrap.test.mjs
git commit -m "docs: publish phase-4 pre-commit cutover guidance"
```

### Task 5: Final verification and session evidence capture

**Files:**
- Modify: `docs/session/current-status.md`
- Modify: `docs/session/tasks.md`
- Modify: `docs/session/change-log.md`
- Modify: `docs/session/open-loops.md` (if cutover risks/decisions changed)

**Step 1: Run full verification**

Run: `cmd /c npm run test`  
Expected: PASS.

Run: `cmd /c node --test ask-core/tests/preCommitCheck.contract.test.mjs ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/policyLifecycleStates.contract.test.mjs ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs`  
Expected: PASS.

Run: `cmd /c node --test tests/askCoreAdapterMigration.test.mjs tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs`  
Expected: PASS.

Run: `cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs`  
Expected: PASS.

Run: `cmd /c node scripts/session/runAskCorePrePushAdapter.mjs`  
Expected: PASS.

**Step 2: Record evidence in session docs**

Capture phase-4 completion status, exact verification commands, and remaining pre-push hybrid open loop.

**Step 3: Commit**

```bash
git add docs/session/current-status.md docs/session/tasks.md docs/session/change-log.md docs/session/open-loops.md
git commit -m "chore: record phase-4 pre-commit cutover verification evidence"
```
