# ASK Core Lifecycle Policy Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate lifecycle-state awareness into `ask preflight` and `ask can-commit` using policy-defined allowed states (`active,paused` by default).

**Architecture:** Extend policy defaults with explicit allowed state lists for preflight and can-commit, then enforce those lists in command handlers while preserving existing JSON payload shapes. Keep adapters unchanged and verify compatibility through contract tests and wrapper checks.

**Tech Stack:** Node.js 20+ ESM, `node --test`, current ask-core policy/session runtime, adapter wrappers under `scripts/session`.

---

Execution discipline for every task:
- Use `@superpowers:test-driven-development` for red/green/refactor.
- Use `@superpowers:verification-before-completion` before each completion claim.

### Task 1: Add failing lifecycle-state matrix contracts for preflight/can-commit

**Files:**
- Modify: `ask-core/tests/preflightCanCommit.contract.test.mjs`

**Step 1: Write failing tests**

```js
test('preflight accepts active and paused session states', () => {
  // seed session status active/paused and verified context
  // expect status 0 for both
});

test('preflight rejects blocked/closed/created states', () => {
  // seed each disallowed state with verified context
  // expect status 1 + lifecycle missing reason
});

test('can-commit rejects blocked/closed/created even with docs/tests evidence true', () => {
  // seed evidence true and disallowed session states
  // expect status 1 + lifecycle missing reason
});
```

**Step 2: Run tests to verify failure**

Run: `node --test ask-core/tests/preflightCanCommit.contract.test.mjs`  
Expected: FAIL because lifecycle matrix checks are not implemented.

**Step 3: Minimal test refactor (if needed)**

Add test helpers only (session/evidence/context seed helpers) so failures are behavior-specific.

**Step 4: Re-run test to verify still failing on behavior**

Run: `node --test ask-core/tests/preflightCanCommit.contract.test.mjs`  
Expected: FAIL with missing lifecycle enforcement.

**Step 5: Commit**

```bash
git add ask-core/tests/preflightCanCommit.contract.test.mjs
git commit -m "test: add lifecycle matrix contracts for preflight and can-commit"
```

### Task 2: Add lifecycle allowed-state policy defaults and parsing support

**Files:**
- Modify: `ask-core/src/policy/defaultPolicy.js`
- Modify: `ask-core/src/core/PolicyEngine.js`
- Modify: `scripts/bootstrapAskCore.cjs`
- Create: `ask-core/tests/policyLifecycleStates.contract.test.mjs`

**Step 1: Write failing parser/default tests**

```js
test('default policy exposes allowed preflight and can-commit states', async () => {
  // load policy from default YAML and expect active/paused for both keys
});

test('policy parser normalizes comma-delimited state lists', async () => {
  // write custom runtime-policy.yaml with spaces/case, assert normalized array output
});
```

**Step 2: Run tests to verify failure**

Run: `node --test ask-core/tests/policyLifecycleStates.contract.test.mjs`  
Expected: FAIL because parser currently returns raw scalar values only.

**Step 3: Write minimal implementation**

```js
session:
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused
```

```js
function parseStateList(value) {
  return String(value).split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
}
```

Return normalized arrays in loaded policy object.

**Step 4: Run tests to verify pass**

Run: `node --test ask-core/tests/policyLifecycleStates.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/policy/defaultPolicy.js ask-core/src/core/PolicyEngine.js scripts/bootstrapAskCore.cjs ask-core/tests/policyLifecycleStates.contract.test.mjs
git commit -m "feat: add lifecycle allowed-state policy defaults and parsing"
```

### Task 3: Enforce lifecycle policy in preflight command

**Files:**
- Modify: `ask-core/src/cli/commands/preflight.js`
- Modify: `ask-core/tests/preflightCanCommit.contract.test.mjs`

**Step 1: Re-run failing preflight matrix test**

Run: `node --test ask-core/tests/preflightCanCommit.contract.test.mjs`  
Expected: FAIL for preflight lifecycle matrix.

**Step 2: Write minimal implementation**

```js
const allowed = policy.session?.allowed_preflight_states ?? ['active', 'paused'];
if (!allowed.includes(session.status)) {
  missing.push(`session state ${session.status || 'created'} not allowed for preflight`);
}
```

Keep existing context checks unchanged.

**Step 3: Run tests to verify pass for preflight branch**

Run: `node --test ask-core/tests/preflightCanCommit.contract.test.mjs`  
Expected: preflight lifecycle tests PASS (can-commit lifecycle tests may still fail until Task 4).

**Step 4: Commit**

```bash
git add ask-core/src/cli/commands/preflight.js ask-core/tests/preflightCanCommit.contract.test.mjs
git commit -m "feat: enforce lifecycle allowed states in preflight"
```

### Task 4: Enforce lifecycle policy in can-commit command

**Files:**
- Modify: `ask-core/src/cli/commands/canCommit.js`
- Modify: `ask-core/tests/preflightCanCommit.contract.test.mjs`

**Step 1: Re-run failing can-commit lifecycle cases**

Run: `node --test ask-core/tests/preflightCanCommit.contract.test.mjs`  
Expected: FAIL on can-commit lifecycle gating.

**Step 2: Write minimal implementation**

```js
const allowed = policy.session?.allowed_can_commit_states ?? ['active', 'paused'];
if (!allowed.includes(session.status)) {
  missing.push(`session state ${session.status || 'created'} not allowed for can-commit`);
}
```

Retain docs/tests evidence checks and output format.

**Step 3: Run tests to verify pass**

Run: `node --test ask-core/tests/preflightCanCommit.contract.test.mjs`  
Expected: PASS.

**Step 4: Commit**

```bash
git add ask-core/src/cli/commands/canCommit.js ask-core/tests/preflightCanCommit.contract.test.mjs
git commit -m "feat: enforce lifecycle allowed states in can-commit"
```

### Task 5: Sync docs and regression checks for lifecycle policy integration

**Files:**
- Modify: `ask-core/README.md`
- Modify: `README.md`
- Modify: `docs/how-it-works.md`
- Modify: `docs/maintainer-mode.md`
- Modify: `tests/askCoreDocs.test.mjs`

**Step 1: Write failing docs regression assertions**

```js
test('docs describe lifecycle-aware preflight/can-commit policy', () => {
  // assert mentions active/paused allowed states and blocked/closed rejection
});
```

**Step 2: Run tests to verify failure**

Run: `node --test tests/askCoreDocs.test.mjs`  
Expected: FAIL until docs are updated.

**Step 3: Write minimal implementation**

Update docs to state:
- lifecycle-aware preflight/can-commit
- default allowed states for both checks
- branch/adapter implications unchanged in phase-3

**Step 4: Run tests to verify pass**

Run: `node --test tests/askCoreDocs.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/README.md README.md docs/how-it-works.md docs/maintainer-mode.md tests/askCoreDocs.test.mjs
git commit -m "docs: add lifecycle policy integration guidance"
```

### Task 6: Final verification and session evidence capture

**Files:**
- Modify: `docs/session/current-status.md`
- Modify: `docs/session/tasks.md`
- Modify: `docs/session/change-log.md`
- Modify: `docs/session/open-loops.md` (if risk decisions changed)

**Step 1: Run full verification**

Run: `cmd /c npm run test`  
Expected: PASS.

Run: `cmd /c node --test ask-core/tests/preflightCanCommit.contract.test.mjs ask-core/tests/policyLifecycleStates.contract.test.mjs ask-core/tests/sessionContext.contract.test.mjs ask-core/tests/sessionStorage.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs`  
Expected: PASS.

Run: `cmd /c node scripts/session/runAskCorePreCommitAdapter.mjs`  
Expected: PASS.

Run: `cmd /c node scripts/session/runAskCorePrePushAdapter.mjs`  
Expected: PASS.

Run: `cmd /c node --test tests/askCoreBootstrap.test.mjs tests/askCoreDocs.test.mjs`  
Expected: PASS.

**Step 2: Record evidence in session docs**

Add concise verification lines and phase-3 lifecycle-policy status to session docs.

**Step 3: Commit**

```bash
git add docs/session/current-status.md docs/session/tasks.md docs/session/change-log.md docs/session/open-loops.md
git commit -m "chore: record phase-3 lifecycle policy verification evidence"
```
