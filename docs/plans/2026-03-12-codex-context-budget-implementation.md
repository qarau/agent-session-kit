# Codex Context Budget Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional ASK runtime integration for Codex Responses API context budgeting with threshold-based compaction and deterministic local state.

**Architecture:** Add a codex context manager module that reads policy, counts input tokens, computes remaining budget, optionally compacts (`explicit` strategy), and persists `.ask/runtime/context-session.json`. Expose this via new `ask codex context` commands and include summary in `ask session doctor`.

**Tech Stack:** Node.js ESM, ask-core CLI/core modules, fetch-based OpenAI API client, Node test runner (`node --test`).

---

Execution discipline for every task:
- Use `@superpowers:test-driven-development` (red -> green -> refactor).
- Use `@superpowers:verification-before-completion` before each completion claim.

### Task 1: Add failing codex context command contracts

**Files:**
- Create: `ask-core/tests/codexContext.contract.test.mjs`

**Step 1: Write failing tests**

Add command contract tests for:

```js
test('codex context status reports disabled policy deterministically', ...);
test('codex context ensure compacts when remaining ratio is below threshold in explicit mode', ...);
test('codex context ensure skips compact when ratio is above threshold', ...);
test('codex context status degrades gracefully when API key is missing', ...);
```

Mock `global.fetch` inside test file.

**Step 2: Run RED**

Run:

```bash
node --test ask-core/tests/codexContext.contract.test.mjs
```

Expected: FAIL (`ask codex` command missing).

**Step 3: Commit failing tests**

```bash
git add ask-core/tests/codexContext.contract.test.mjs
git commit -m "test: add codex context budget command contracts"
```

### Task 2: Implement codex context manager and CLI commands

**Files:**
- Create: `ask-core/src/integrations/codex/ContextBudgetManager.js`
- Create: `ask-core/src/cli/commands/codex.js`
- Modify: `ask-core/src/cli/index.js`
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/policy/defaultPolicy.js`
- Modify: `ask-core/src/core/PolicyEngine.js`

**Step 1: Verify RED still fails**

```bash
node --test ask-core/tests/codexContext.contract.test.mjs
```

Expected: FAIL.

**Step 2: Implement minimal runtime**

1. Policy defaults:
   - `codex_context.enabled=false`
   - `min_remaining_ratio=0.10`
   - `reserve_output_tokens=12000`
   - `strategy=explicit`
2. Add AskPaths entry for `.ask/runtime/context-session.json`.
3. Implement manager methods:
   - `status()`
   - `ensure()`
   - `compact()`
4. Implement CLI routing:
   - `ask codex context status`
   - `ask codex context ensure`
   - `ask codex context compact`

**Step 3: Run GREEN**

```bash
node --test ask-core/tests/codexContext.contract.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add ask-core/src/integrations/codex/ContextBudgetManager.js ask-core/src/cli/commands/codex.js ask-core/src/cli/index.js ask-core/src/fs/AskPaths.js ask-core/src/policy/defaultPolicy.js ask-core/src/core/PolicyEngine.js
git commit -m "feat: add codex context budget manager and CLI commands"
```

### Task 3: Integrate session doctor codex summary

**Files:**
- Modify: `ask-core/src/cli/commands/session.js`
- Modify: `ask-core/tests/sessionDoctor.contract.test.mjs`

**Step 1: Write/adjust failing doctor tests**

Add assertion that doctor includes codex summary when `.ask/runtime/context-session.json` exists.

**Step 2: Run RED**

```bash
node --test ask-core/tests/sessionDoctor.contract.test.mjs
```

Expected: FAIL until doctor includes codex summary.

**Step 3: Implement summary integration**

Add doctor payload extension:

```json
"codexContext": {
  "enabled": true,
  "status": "ok",
  "remainingRatio": 0.17,
  "suggestedAction": "compact-soon"
}
```

**Step 4: Run GREEN**

```bash
node --test ask-core/tests/sessionDoctor.contract.test.mjs ask-core/tests/codexContext.contract.test.mjs
```

Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/cli/commands/session.js ask-core/tests/sessionDoctor.contract.test.mjs
git commit -m "feat: include codex context summary in session doctor"
```

### Task 4: Docs + full verification evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/how-it-works.md`
- Modify: `docs/maintainer-mode.md`
- Modify: `docs/session/current-status.md`
- Modify: `docs/session/tasks.md`
- Modify: `docs/session/change-log.md`

**Step 1: Update docs**

Document:
1. optional `codex_context` policy keys
2. `ask codex context status|ensure|compact`
3. advisory behavior on API/network failures

**Step 2: Run full verification**

```bash
cmd /c npm run test
cmd /c node --test ask-core/tests/codexContext.contract.test.mjs ask-core/tests/sessionDoctor.contract.test.mjs ask-core/tests/guardedCommandRunner.contract.test.mjs
cmd /c node --test tests/askCoreAdapterMigration.test.mjs tests/askCoreDocs.test.mjs
cmd /c node ask-core/bin/ask.js codex context status
cmd /c node ask-core/bin/ask.js session doctor
```

Expected: all PASS.

**Step 3: Commit**

```bash
git add README.md docs/how-it-works.md docs/maintainer-mode.md docs/session/current-status.md docs/session/tasks.md docs/session/change-log.md
git commit -m "chore: document and verify codex context budget integration"
```
