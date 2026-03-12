# ASK Runtime Stall Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add deterministic stall detection, one automatic retry, and runtime doctor visibility so ASK runtime checks recover from hangs safely before failing.

**Architecture:** Introduce a shared ask-core guarded command runner that enforces `180s` wall/no-output timeout defaults with one retry on stall-only errors. Persist operation lifecycle state to `.ask/runtime/last-operation.json`, wire adapters to this runner, and add `ask session doctor` to report latest operation status and recovery guidance.

**Tech Stack:** Node.js ESM, `child_process.spawn`, ask-core CLI/core modules, Node test runner (`node --test`).

---

Execution discipline for every task:
- Use `@superpowers:test-driven-development` (red -> green -> refactor).
- Use `@superpowers:verification-before-completion` before each completion claim.

### Task 1: Add failing contracts for guarded execution + operation state

**Files:**
- Create: `ask-core/tests/guardedCommandRunner.contract.test.mjs`
- Create: `ask-core/tests/fixtures/guarded-command/emitThenHang.mjs`
- Create: `ask-core/tests/fixtures/guarded-command/exitCode.mjs`
- Create: `ask-core/tests/fixtures/guarded-command/hangNoOutput.mjs`

**Step 1: Write failing tests**

Add contract tests:

```js
test('runner retries once on stall then succeeds', ...);
test('runner fails after second stall with deterministic reason', ...);
test('runner does not retry non-zero exits', ...);
test('runner writes last-operation state transitions', ...);
```

Use low timeout overrides in tests (`120ms-300ms`) to keep test runtime short.

**Step 2: Run RED**

Run:

```bash
node --test ask-core/tests/guardedCommandRunner.contract.test.mjs
```

Expected: FAIL (runner/state module missing).

**Step 3: Commit failing tests**

```bash
git add ask-core/tests/guardedCommandRunner.contract.test.mjs ask-core/tests/fixtures/guarded-command
git commit -m "test: add guarded command runner stall recovery contracts"
```

### Task 2: Implement guarded runner and runtime operation state

**Files:**
- Create: `ask-core/src/core/GuardedCommandRunner.js`
- Create: `ask-core/src/core/RuntimeOperationStore.js`
- Modify: `ask-core/src/fs/AskPaths.js`

**Step 1: Verify RED remains**

```bash
node --test ask-core/tests/guardedCommandRunner.contract.test.mjs
```

Expected: FAIL.

**Step 2: Implement minimal runtime**

1. Add `AskPaths.runtimeDir()` and `AskPaths.lastOperation()`.
2. Add `RuntimeOperationStore` to persist:
   - `running`, `retrying`, `succeeded`, `failed`
3. Implement guarded runner with:
   - `wallTimeoutMs` default `180000`
   - `noOutputTimeoutMs` default `180000`
   - `maxRetriesOnStall` default `1`
4. Stall-only retry policy:
   - retry on `wall-timeout` or `no-output-timeout`
   - no retry on non-zero command exit

**Step 3: Run GREEN**

```bash
node --test ask-core/tests/guardedCommandRunner.contract.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add ask-core/src/core/GuardedCommandRunner.js ask-core/src/core/RuntimeOperationStore.js ask-core/src/fs/AskPaths.js
git commit -m "feat: add guarded command runner with stall retry state tracking"
```

### Task 3: Wire pre-commit/pre-push adapters to guarded runner

**Files:**
- Modify: `ask-core/src/adapters/sessionKit/runPreCommitAdapter.js`
- Modify: `ask-core/src/adapters/sessionKit/runPrePushAdapter.js`
- Modify: `tests/askCoreAdapterMigration.test.mjs` (if timing/diagnostic assertions need update)

**Step 1: Run targeted adapter tests (pre-wire baseline)**

```bash
node --test tests/askCoreAdapterMigration.test.mjs
```

Expected: PASS on baseline behavior.

**Step 2: Implement adapter integration**

Replace direct `spawnSync` calls with guarded runner per adapter command:
- `ask init`
- `ask session start`
- `ask context verify`
- `ask pre-commit-check` or `ask pre-push-check`

Keep evidence marker writes unchanged.

**Step 3: Run adapter + runner tests**

```bash
node --test tests/askCoreAdapterMigration.test.mjs ask-core/tests/guardedCommandRunner.contract.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add ask-core/src/adapters/sessionKit/runPreCommitAdapter.js ask-core/src/adapters/sessionKit/runPrePushAdapter.js tests/askCoreAdapterMigration.test.mjs
git commit -m "feat: wire ask-core adapters through guarded command runner"
```

### Task 4: Add `ask session doctor` runtime inspection command

**Files:**
- Create: `ask-core/tests/sessionDoctor.contract.test.mjs`
- Modify: `ask-core/src/cli/commands/session.js`
- Modify: `ask-core/src/cli/index.js` (help text)
- Modify: `ask-core/src/core/SessionRuntime.js` (only if helper method is needed)
- Modify: `tests/askCoreDocs.test.mjs` (if docs assertions expand)

**Step 1: Write failing doctor tests**

Add contract tests:

```js
test('session doctor reports missing operation state deterministically', ...);
test('session doctor reports retrying/failed state with recovery hint', ...);
test('session doctor reports succeeded state after healthy run', ...);
```

**Step 2: Run RED**

```bash
node --test ask-core/tests/sessionDoctor.contract.test.mjs
```

Expected: FAIL (`session doctor` missing).

**Step 3: Implement doctor command**

1. Extend `runSession` with `doctor`.
2. Read `.ask/runtime/last-operation.json`.
3. Emit deterministic JSON payload:
   - `ok`
   - `status`
   - `operation`
   - `attempt`
   - `maxAttempts`
   - `failureReason`
   - `suggestedRecovery`

**Step 4: Run GREEN**

```bash
node --test ask-core/tests/sessionDoctor.contract.test.mjs ask-core/tests/guardedCommandRunner.contract.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/tests/sessionDoctor.contract.test.mjs ask-core/src/cli/commands/session.js ask-core/src/cli/index.js ask-core/src/core/SessionRuntime.js tests/askCoreDocs.test.mjs
git commit -m "feat: add ask session doctor for runtime stall diagnostics"
```

### Task 5: Docs update + full verification evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/how-it-works.md`
- Modify: `docs/maintainer-mode.md`
- Modify: `docs/session/current-status.md`
- Modify: `docs/session/tasks.md`
- Modify: `docs/session/change-log.md`
- Modify: `docs/session/open-loops.md`

**Step 1: Update docs**

Document:
1. stall timeout defaults (`180s`)
2. one retry on stall
3. `ask session doctor` usage

**Step 2: Run full verification**

```bash
cmd /c npm run test
cmd /c node --test ask-core/tests/guardedCommandRunner.contract.test.mjs ask-core/tests/sessionDoctor.contract.test.mjs ask-core/tests/preCommitCheck.contract.test.mjs ask-core/tests/prePushCheck.contract.test.mjs
cmd /c node --test tests/askCoreAdapterMigration.test.mjs tests/askCoreDocs.test.mjs
cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs
cmd /c node scripts/session/runAskCorePrePushAdapter.mjs
```

Expected: all PASS.

**Step 3: Record evidence and commit**

```bash
git add README.md docs/how-it-works.md docs/maintainer-mode.md docs/session/current-status.md docs/session/tasks.md docs/session/change-log.md docs/session/open-loops.md
git commit -m "chore: document and verify runtime stall recovery flow"
```
