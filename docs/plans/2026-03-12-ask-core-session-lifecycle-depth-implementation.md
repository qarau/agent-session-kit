# ASK Core Session Lifecycle Depth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a full-audit ASK session lifecycle (`created/active/paused/resumed/blocked/closed`) with transactional snapshot+journal persistence and CLI contracts.

**Architecture:** Keep `active-session.json` as the fast-read projection while introducing append-only `history.ndjson` and `pending-transition.json` for transactional safety. Route new lifecycle commands through `SessionRuntime`, then recover/project deterministically from history on startup and interrupted writes.

**Tech Stack:** Node.js 20+ ESM, `node --test`, filesystem JSON/NDJSON persistence, existing `ask-core` CLI and adapter wrappers.

---

Execution discipline for every task:
- Use `@superpowers:test-driven-development` (red -> green -> refactor).
- Use `@superpowers:verification-before-completion` before each task-complete claim.

### Task 1: Add lifecycle contract tests for new session commands

**Files:**
- Create: `ask-core/tests/sessionLifecycle.contract.test.mjs`
- Modify: `ask-core/tests/sessionContext.contract.test.mjs` (if command behavior assertions need alignment)

**Step 1: Write the failing test**

```js
test('session lifecycle transitions append history and update snapshot', () => {
  // start -> pause -> resume -> block -> close
  // assert .ask/sessions/history.ndjson has ordered transitions
  // assert active-session.json status is closed at end
});

test('invalid transition returns deterministic JSON error with exit 1', () => {
  // close session, then attempt pause
  // expect status 1 and { ok:false, code:'invalid-transition', allowed:[...] }
});
```

**Step 2: Run test to verify it fails**

Run: `node --test ask-core/tests/sessionLifecycle.contract.test.mjs`  
Expected: FAIL because new lifecycle transitions and error contracts are not implemented.

**Step 3: Write minimal implementation scaffolding**

```js
const VALID_TRANSITIONS = {
  created: ['active'],
  active: ['paused', 'blocked', 'closed'],
  paused: ['resumed', 'closed'],
  blocked: ['resumed', 'closed'],
  resumed: ['paused', 'blocked', 'closed']
};
```

Create only enough scaffolding to move failures from "missing command/state machine" to concrete assertion failures.

**Step 4: Re-run tests**

Run: `node --test ask-core/tests/sessionLifecycle.contract.test.mjs`  
Expected: still failing, but now specifically on persistence and transition behavior (ready for Task 2/3).

**Step 5: Commit**

```bash
git add ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionContext.contract.test.mjs
git commit -m "test: add ask-core lifecycle transition contracts"
```

### Task 2: Add session journal/pending filesystem primitives

**Files:**
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/fs/FileStore.js`
- Modify: `ask-core/src/fs/Scaffolder.js`
- Create: `ask-core/tests/sessionStorage.contract.test.mjs`

**Step 1: Write the failing test**

```js
test('ask init scaffolds session history file and no pending marker', () => {
  // run ask init
  // assert .ask/sessions/history.ndjson exists
  // assert .ask/sessions/pending-transition.json does not exist
});

test('FileStore appendNdjson and readNdjson preserve event order', async () => {
  // append two events, read back, assert order and parsed content
});
```

**Step 2: Run test to verify it fails**

Run: `node --test ask-core/tests/sessionStorage.contract.test.mjs`  
Expected: FAIL because paths/store NDJSON helpers do not exist yet.

**Step 3: Write minimal implementation**

```js
historyLog() { return path.join(this.sessionsDir(), 'history.ndjson'); }
pendingTransition() { return path.join(this.sessionsDir(), 'pending-transition.json'); }
```

```js
async appendNdjson(filePath, record) {
  await this.ensureDir(path.dirname(filePath));
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}
```

Ensure `Scaffolder.init()` creates `history.ndjson` if missing.

**Step 4: Run test to verify it passes**

Run: `node --test ask-core/tests/sessionStorage.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/fs/AskPaths.js ask-core/src/fs/FileStore.js ask-core/src/fs/Scaffolder.js ask-core/tests/sessionStorage.contract.test.mjs
git commit -m "feat: add ask-core session journal storage primitives"
```

### Task 3: Implement lifecycle transaction engine and CLI command surface

**Files:**
- Modify: `ask-core/src/core/SessionRuntime.js`
- Modify: `ask-core/src/cli/index.js`
- Modify: `ask-core/src/cli/commands/session.js`
- Modify: `ask-core/tests/sessionLifecycle.contract.test.mjs`
- Modify: `ask-core/package.json` (if explicit lifecycle test script is added)

**Step 1: Write/update failing tests for command parsing and reason requirements**

```js
test('pause/resume/block/close require --reason except start/status', () => {
  // missing --reason returns exit 1 + JSON error
});
```

**Step 2: Run tests to verify failure**

Run: `node --test ask-core/tests/sessionLifecycle.contract.test.mjs`  
Expected: FAIL on CLI argument parsing and transition persistence behavior.

**Step 3: Write minimal implementation**

```js
export async function runCli(args) {
  const [command, subcommand, ...rest] = args;
  if (command === 'session') {
    await runSession(subcommand, rest);
    return;
  }
}
```

```js
await runtime.transition('pause', { reason, sourceCommand: 'session pause' });
```

Implement transactional flow in `SessionRuntime`:
- write pending marker
- append journal event
- project snapshot
- clear pending marker

**Step 4: Run tests to verify pass**

Run: `node --test ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/core/SessionRuntime.js ask-core/src/cli/index.js ask-core/src/cli/commands/session.js ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/package.json
git commit -m "feat: implement ask-core lifecycle transitions and CLI contracts"
```

### Task 4: Add interrupted-write recovery and legacy snapshot migration

**Files:**
- Create: `ask-core/tests/sessionRecovery.contract.test.mjs`
- Modify: `ask-core/src/core/SessionRuntime.js`
- Modify: `ask-core/src/fs/FileStore.js` (if additional atomic/recovery helpers are needed)

**Step 1: Write the failing test**

```js
test('recovery finalizes snapshot when pending transition already in history', () => {
  // seed pending marker + history event, run session status, assert pending cleared
});

test('legacy active-session without history gets synthetic created/active lineage', () => {
  // seed legacy snapshot only, run lifecycle command, assert bootstrapped history
});
```

**Step 2: Run test to verify it fails**

Run: `node --test ask-core/tests/sessionRecovery.contract.test.mjs`  
Expected: FAIL because recovery/migration flow is not implemented.

**Step 3: Write minimal implementation**

```js
async recoverIfPending() {
  const pending = await this.store.readJson(this.paths.pendingTransition(), null);
  if (!pending) return;
  // if event exists in history -> reproject + clear marker
  // else emit deterministic recovery error
}
```

Add migration guard:
- if snapshot exists and history is empty, write synthetic `created` then `active` events before first new transition.

**Step 4: Run tests to verify it passes**

Run: `node --test ask-core/tests/sessionRecovery.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/tests/sessionRecovery.contract.test.mjs ask-core/src/core/SessionRuntime.js ask-core/src/fs/FileStore.js
git commit -m "feat: add ask-core lifecycle recovery and legacy migration"
```

### Task 5: Sync bootstrap templates and lifecycle documentation

**Files:**
- Modify: `scripts/bootstrapAskCore.cjs`
- Modify: `tests/askCoreBootstrap.test.mjs`
- Modify: `tests/askCoreDocs.test.mjs`
- Modify: `ask-core/README.md`
- Modify: `README.md`
- Modify: `docs/how-it-works.md`
- Modify: `docs/maintainer-mode.md`

**Step 1: Write failing docs/bootstrap assertions**

```js
test('bootstrap ask init creates lifecycle history scaffolding', () => {
  // assert .ask/sessions/history.ndjson exists after init
});

test('docs mention lifecycle commands and transaction recovery files', () => {
  // assert pause/resume/block/close and pending-transition/history.ndjson references
});
```

**Step 2: Run tests to verify failure**

Run: `node --test tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs`  
Expected: FAIL until docs and bootstrap template are aligned.

**Step 3: Write minimal implementation**

Update docs and bootstrap template to match runtime behavior:
- lifecycle command usage
- journal + pending marker behavior
- recovery expectations for maintainers.

**Step 4: Run tests to verify pass**

Run: `node --test tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/bootstrapAskCore.cjs tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs ask-core/README.md README.md docs/how-it-works.md docs/maintainer-mode.md
git commit -m "docs: align bootstrap and lifecycle runtime guidance"
```

### Task 6: Final verification and session evidence capture

**Files:**
- Modify: `docs/session/current-status.md`
- Modify: `docs/session/tasks.md`
- Modify: `docs/session/change-log.md`
- Modify: `docs/session/open-loops.md` (if cutover risks/decisions changed)

**Step 1: Run full verification**

Run: `cmd /c npm run test`  
Expected: PASS.

Run: `cmd /c node --test ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs`  
Expected: PASS.

Run: `cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs`  
Expected: PASS.

Run: `cmd /c node scripts/session/runAskCorePrePushAdapter.mjs`  
Expected: PASS.

**Step 2: Record verification evidence**

Add concise evidence entries to `docs/session/change-log.md` and update `current-status/tasks/open-loops` for phase-2 lifecycle progress.

**Step 3: Commit**

```bash
git add docs/session/current-status.md docs/session/tasks.md docs/session/change-log.md docs/session/open-loops.md
git commit -m "chore: record phase-2 lifecycle verification evidence"
```
