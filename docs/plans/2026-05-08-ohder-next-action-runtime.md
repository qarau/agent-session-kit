# OHDER Next Action Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `ask next` architecture-aware so OHDER can recommend the next governed action when there are no active or ready ASK tasks.

**Architecture:** Keep task selection in the ASK CLI, but delegate architecture-driven fallback decisions to a focused OHDER next-action engine. The new engine should read existing runtime state, architect status, refactor governance signals, and task queues, then return a deterministic next action without mutating state. Later slices may materialize refactor tasks, but this plan first makes the decision surface explicit and testable.

**Tech Stack:** Node.js ESM, `node:test`, ASK Core runtime modules under `ask-core/src`, CLI command tests under `ask-core/tests`.

---

## Context

The yellow OHDER loop spec says ASK should decide `continue / retry / block / close` after OHDER governance validation, entropy measurement, refactor governance, checkpointing, and resume-packet updates.

Current ASK already has:

- the 16-step loop state machine
- `ArchitectRuntime`
- OHDER law packs
- architecture scoring
- refactor governance evaluation
- `ask slice close` OHDER blocking
- `ask next` task queue selection

The current gap is that `ask next` falls back to stale runtime text when no task is active or ready. It does not ask OHDER whether architecture health should drive the next action.

Reference spec:

- `docs/ASK/ask_runtime_ohder_loop_integration_spec_v_2_yellow.md`

Primary implementation references:

- `ask-core/src/cli/commands/next.js`
- `ask-core/src/core/ArchitectRuntime.js`
- `ask-core/src/core/RefactorGovernanceEngine.js`
- `ask-core/src/core/RuntimeStateEngine.js`
- `ask-core/src/core/TaskRuntime.js`
- `ask-core/tests/nextAction.contract.test.mjs`
- `ask-core/tests/ohderLawPack.contract.test.mjs`

---

### Task 1: Add an OHDER Next Action Decision Engine

**Files:**

- Create: `ask-core/src/core/OhderNextActionEngine.js`
- Test: `ask-core/tests/ohderNextAction.contract.test.mjs`

**Step 1: Write failing decision-engine tests**

Create tests that instantiate the engine directly and prove these deterministic decisions:

- blocking architect status returns `resolve-architecture-block`
- refactor governance required returns `create-refactor-slice`
- high replayability risk returns `run-governance-validation`
- healthy architecture with no task pressure returns `await-new-requirement`

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderNextAction.contract.test.mjs
```

Expected: fail because `OhderNextActionEngine.js` does not exist.

**Step 2: Implement the minimum engine**

Create a pure engine with a method similar to:

```js
decide({ state, architect, refactorGovernance, tasks })
```

Return shape:

```js
{
  type: 'ohder-action',
  action: 'await-new-requirement',
  reason: 'architecture governance clear and no ready tasks available',
  blocking: false,
  source: 'ohder-next-action',
  architectStatus: 'warning',
  architectureScore: 99,
  recommendedCommand: ''
}
```

Decision precedence:

1. If there is an active or ready task, return `null`; existing ASK task selection owns the decision.
2. If `architect.blocking === true`, return `resolve-architecture-block`.
3. If `refactorGovernance.required === true`, return `create-refactor-slice`.
4. If replayability risk is high, architecture score is low, or governance decision is blocked, return `run-governance-validation`.
5. If there are no tasks and no architecture pressure, return `await-new-requirement`.

Use existing policy thresholds where available; otherwise keep defaults simple and deterministic.

**Step 3: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderNextAction.contract.test.mjs
```

Expected: all new engine tests pass.

**Step 4: Commit through ASK**

Close the materialized ASK slice with:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one `ASK-Slice` commit for this slice.

---

### Task 2: Integrate OHDER Fallback Into `ask next`

**Files:**

- Modify: `ask-core/src/cli/commands/next.js`
- Modify: `ask-core/tests/nextAction.contract.test.mjs`
- Possibly modify: `ask-core/src/cli/index.js` only if a new CLI help line is required

**Step 1: Write failing `ask next` tests**

Add contract tests proving:

- ready tasks still win over OHDER recommendations
- in-progress tasks still win over OHDER recommendations
- when there are no tasks and architect status is blocking, `next.type === 'ohder-action'`
- when there are no tasks and architecture is healthy, `next.action === 'await-new-requirement'`

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/nextAction.contract.test.mjs
```

Expected: new OHDER fallback tests fail because `ask next` still returns `runtime-action`.

**Step 2: Wire the decision engine into `runNext`**

Update `ask-core/src/cli/commands/next.js`:

- load architect status from the existing architect status path or runtime API
- evaluate refactor governance using existing `RefactorGovernanceEngine`
- call `OhderNextActionEngine.decide(...)` only when no ready task and no current task exist
- preserve existing JSON fields: `runtime`, `tasks`, `next`
- add a compact `ohder` field with status, blocking flag, score, and selected action

Do not mutate tasks or runtime state in this slice.

**Step 3: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/nextAction.contract.test.mjs
```

Expected: all next-action tests pass.

**Step 4: Commit through ASK**

Close the materialized ASK slice with:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one `ASK-Slice` commit for this slice.

---

### Task 3: Emit Replayable OHDER Next-Action Evidence

**Files:**

- Modify: `ask-core/src/cli/commands/next.js`
- Possibly create: `ask-core/src/core/OhderNextActionRuntime.js`
- Modify: `ask-core/tests/nextAction.contract.test.mjs`

**Step 1: Write failing ledger evidence test**

Add a test proving an OHDER fallback decision emits a replayable runtime event such as:

```text
OhderNextActionRecommended
```

Expected payload fields:

- `action`
- `reason`
- `architectStatus`
- `architectureScore`
- `blocking`
- `recommendedCommand`

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/nextAction.contract.test.mjs
```

Expected: fail because `ask next` does not emit OHDER next-action evidence.

**Step 2: Add event emission without changing task state**

If `runNext` should stay thin, create `OhderNextActionRuntime` to own:

- reading architect status
- evaluating refactor governance
- running the decision engine
- appending the event
- projecting incrementally

Event emission must happen only when an OHDER fallback action is selected, not when active or ready tasks are selected.

**Step 3: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/nextAction.contract.test.mjs
```

Expected: next-action tests pass and event projection remains stable.

**Step 4: Commit through ASK**

Close the materialized ASK slice with:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one `ASK-Slice` commit for this slice.

---

### Task 4: Document OHDER-Driven Next Actions

**Files:**

- Modify: `README.md`
- Modify: `docs/operations/runtime-architecture.md`
- Modify: `docs/operations/operator-playbooks.md`

**Step 1: Update operator-facing docs**

Document:

- why `ask next` can return `ohder-action`
- how `resolve-architecture-block`, `create-refactor-slice`, `run-governance-validation`, and `await-new-requirement` differ
- that `ask next` does not mutate tasks when surfacing OHDER recommendations
- how this fits into the 16-step OHDER loop

**Step 2: Verify docs text**

Run:

```bash
rg -n "OHDER-driven next|ohder-action|await-new-requirement|create-refactor-slice|resolve-architecture-block" README.md docs/operations
```

Expected: all important terms appear in the docs.

**Step 3: Run ASK gates**

Run:

```bash
node ask-core/bin/ask.js preflight
node ask-core/bin/ask.js can-commit
node ask-core/bin/ask.js pre-push-check
```

Expected: all pass.

**Step 4: Commit through ASK**

Close the materialized ASK slice with:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one `ASK-Slice` commit for this slice.

---

## Acceptance Criteria

- `ask next` remains task-first: active and ready tasks still take precedence.
- When no task is available, `ask next` returns deterministic OHDER recommendations instead of stale runtime text.
- OHDER next-action decisions are replayable through the event ledger.
- The runtime does not auto-create refactor tasks in this plan; it only recommends them.
- Documentation explains the new behavior and operator response path.
- Each implementation slice closes through `ask slice close <taskId>` and produces a small governed commit.

