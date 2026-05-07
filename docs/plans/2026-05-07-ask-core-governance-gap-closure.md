# ASK Core Governance Gap Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the reviewed ASK Core governance gaps so v5.0.0 enforcement is reliable for first pushes, concurrent runtime events, real integration validation, plan ingestion durability, slice-scoped commits, and package metadata.

**Architecture:** Keep the existing runtime architecture: event-ledger-first state changes, projection snapshots, policy-driven gates, and contract tests. Each change should be implemented as a small governed slice with a failing test first, a minimal fix, targeted verification, then a slice commit.

**Tech Stack:** Node.js ESM, `node:test`, Git CLI, ASK Core runtime modules under `ask-core/src`, contract tests under `ask-core/tests`.

---

### Task 1: Fix First-Push Slice Commit Governance

**Files:**
- Modify: `ask-core/src/core/PrePushCheckEngine.js`
- Modify: `ask-core/tests/prePushCheck.contract.test.mjs`

**Step 1: Write the failing test**

Add a contract test that creates a branch with no upstream and at least two outgoing commits:
- an earlier code commit missing `ASK-Slice` / `ASK-Exempt`
- a later metadata commit with `ASK-Exempt: meta`

Expected result: `ask pre-push-check` must fail and report the earlier missing footer.

**Step 2: Run the targeted test**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/prePushCheck.contract.test.mjs
```

Expected: the new test fails because only `HEAD` is checked when no upstream exists.

**Step 3: Implement commit range resolution**

Update `PrePushCheckEngine.getOutgoingCommits()` and `getOutgoingFiles()` so no-upstream branches inspect the full local branch range that would be pushed.

Preferred approach:
- detect merge base against `origin/main` or `main` when available
- fall back to all commits reachable from `HEAD` only when no better base exists
- keep behavior for configured upstream unchanged

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/prePushCheck.contract.test.mjs
```

Expected: all pre-push tests pass, including first-push multi-commit coverage.

**Step 5: Commit slice**

```bash
git add ask-core/src/core/PrePushCheckEngine.js ask-core/tests/prePushCheck.contract.test.mjs
git commit -m "fix(pre-push): check full first-push commit range" -m "ASK-Slice: gap-001"
```

---

### Task 2: Make Runtime Sequence Allocation Concurrency-Safe

**Files:**
- Modify: `ask-core/src/runtime/SequenceStore.js`
- Modify: `ask-core/tests/eventLedger.foundation.contract.test.mjs`

**Step 1: Write the failing test**

Add a test that calls `SequenceStore.next()` concurrently, for example 20 simultaneous calls, and asserts:
- every returned sequence is unique
- values are contiguous from `1..20`
- persisted `nextSeq` is `21`

**Step 2: Run the targeted test**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/eventLedger.foundation.contract.test.mjs
```

Expected: the new test fails because concurrent calls can all read the same `nextSeq`.

**Step 3: Implement a lock around sequence allocation**

Implement cross-process-safe allocation using a small lock file in `.ask/runtime/`.

Requirements:
- acquire lock with exclusive create semantics
- wait/retry briefly when another process holds it
- write the updated sequence file before releasing the lock
- cleanly release the lock in `finally`
- return deterministic error if lock cannot be acquired in a bounded timeout

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/eventLedger.foundation.contract.test.mjs
```

Expected: all event ledger tests pass.

**Step 5: Commit slice**

```bash
git add ask-core/src/runtime/SequenceStore.js ask-core/tests/eventLedger.foundation.contract.test.mjs
git commit -m "fix(runtime): serialize event sequence allocation" -m "ASK-Slice: gap-002"
```

---

### Task 3: Run Integration Commands in a Real Git Worktree

**Files:**
- Modify: `ask-core/src/git/IntegrationTempWorktreeManager.js`
- Modify: `ask-core/src/core/IntegrationRuntime.js`
- Modify: `ask-core/tests/integrationRuntime.contract.test.mjs`

**Step 1: Write the failing test**

Add a contract test proving integration runs inside a checked-out repo workspace:
- create a source file or package file in the repo
- run `ask integration run` with a command that reads that file
- assert the command passes only if the integration workspace contains repo files

**Step 2: Run the targeted test**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/integrationRuntime.contract.test.mjs
```

Expected: the new test fails because the current workspace is an empty directory.

**Step 3: Implement real worktree provisioning**

Update `IntegrationTempWorktreeManager.provision()` to create a real git worktree.

Requirements:
- resolve current `HEAD`
- create a temporary worktree under `.ask/runtime/integration-workspaces/<runId>`
- use a detached worktree or unique temporary branch
- clean up with `git worktree remove --force`
- keep a safe fallback error if git worktree provisioning fails

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/integrationRuntime.contract.test.mjs
```

Expected: integration runtime tests pass and prove repo files are available.

**Step 5: Commit slice**

```bash
git add ask-core/src/git/IntegrationTempWorktreeManager.js ask-core/src/core/IntegrationRuntime.js ask-core/tests/integrationRuntime.contract.test.mjs
git commit -m "fix(integration): run checks in real git worktree" -m "ASK-Slice: gap-003"
```

---

### Task 4: Make Plan Ingestion Durable and Recoverable

**Files:**
- Modify: `ask-core/src/core/PlanIngestRuntime.js`
- Modify: `ask-core/tests/planIngest.contract.test.mjs`

**Step 1: Write the failing test**

Add a test that simulates failure during ingestion after some ledger events are appended but before `plan-batches.json` is updated.

Expected behavior after the fix:
- the runtime records a pending or failed batch state before appending materialization events
- retry does not silently duplicate already materialized slices
- `plan batch show` reports enough state to recover or diagnose the interrupted ingest

**Step 2: Run the targeted test**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/planIngest.contract.test.mjs
```

Expected: the new test fails under the current write-at-end registry model.

**Step 3: Implement staged batch registry updates**

Update ingestion flow:
- write a `pending` batch record before appending materialization events
- append events
- update the batch to `completed`
- mark batch `failed` with error metadata if ingestion throws
- make duplicate detection account for `pending`, `completed`, and `failed` states

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/planIngest.contract.test.mjs
```

Expected: plan ingest tests pass.

**Step 5: Commit slice**

```bash
git add ask-core/src/core/PlanIngestRuntime.js ask-core/tests/planIngest.contract.test.mjs
git commit -m "fix(plan): make ingestion batch state recoverable" -m "ASK-Slice: gap-004"
```

---

### Task 5: Prevent Slice Close From Committing Unrelated Work

**Files:**
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `ask-core/tests/sliceClose.contract.test.mjs`
- Possibly modify: `ask-core/src/policy/defaultPolicy.js`
- Possibly modify: `docs/operations/policy-reference.md`

**Step 1: Write the failing test**

Add a test with unrelated dirty files present before `ask slice close`.

Expected behavior after the fix:
- slice close refuses to commit when unrelated pre-existing dirty files exist, or
- slice close commits only explicitly allowed files for the slice

Use the safer first implementation: fail closed on pre-existing dirty files unless policy allows broad staging.

**Step 2: Run the targeted test**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/sliceClose.contract.test.mjs
```

Expected: the new test fails because `git add -A` commits everything.

**Step 3: Implement dirty-worktree guard**

Before verification/completion/commit:
- capture dirty state
- if policy disallows broad staging and dirty files are already present, return a deterministic failure
- avoid completing the task before this guard passes

Keep existing successful slice-close behavior unchanged for clean worktrees.

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/sliceClose.contract.test.mjs
```

Expected: slice close tests pass.

**Step 5: Commit slice**

```bash
git add ask-core/src/core/SliceCloseRuntime.js ask-core/tests/sliceClose.contract.test.mjs ask-core/src/policy/defaultPolicy.js docs/operations/policy-reference.md
git commit -m "fix(slice): guard auto commit against unrelated dirty work" -m "ASK-Slice: gap-005"
```

---

### Task 6: Align ASK Core Package Version Metadata

**Files:**
- Modify: `ask-core/package.json`
- Modify: `docs/releases/v5.0.0.md` if present or create if missing
- Test: existing package/version checks, if any

**Step 1: Confirm current version state**

Run:

```bash
node -e "console.log(require('./package.json').version); console.log(require('./ask-core/package.json').version)"
```

Expected before fix: root is `5.0.0`, `ask-core` is `4.0.1`.

**Step 2: Update metadata**

Set `ask-core/package.json` to `5.0.0`.

**Step 3: Add or update release note**

Ensure v5.0.0 release notes mention:
- plan ingestion runtime
- slice close runtime
- architect/flow/design runtimes
- coordination and delivery runtimes
- pre-push slice lineage enforcement
- ASK Forge branding

**Step 4: Run verification**

Run:

```bash
npm test
```

Expected: all tests pass.

**Step 5: Commit slice**

```bash
git add ask-core/package.json docs/releases/v5.0.0.md
git commit -m "release: align ASK Core package metadata for v5.0.0" -m "ASK-Exempt: release"
```

---

### Final Verification

Run:

```bash
npm test
node ask-core/bin/ask.js preflight
node ask-core/bin/ask.js can-commit
node ask-core/bin/ask.js pre-push-check
```

Expected:
- all contract tests pass
- ASK gates produce deterministic JSON
- outgoing commits each have `ASK-Slice` or valid `ASK-Exempt`

### Recommended Execution Order

1. `gap-001`: pre-push first-push governance
2. `gap-002`: sequence allocation locking
3. `gap-003`: real integration worktrees
4. `gap-004`: durable plan ingestion
5. `gap-005`: slice close dirty-worktree guard
6. `gap-006`: v5 package metadata alignment
