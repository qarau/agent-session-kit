# OHDER Refactor Governance Materialization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn OHDER entropy and refactor pressure into governed ASK refactor tasks that can be previewed, approved, materialized, executed, and replayed.

**Architecture:** Keep detection, recommendation, materialization, approval, and next-action orchestration separate. OHDER should decide when architectural pressure exists, the refactor recommendation engine should convert that pressure into deterministic recommendations, ASK should materialize recommendations as normal governed tasks, and `ask next` should surface the next safe operator action without silently creating work unless policy allows it.

**Tech Stack:** Node.js ESM, `node:test`, ASK Core runtime modules under `ask-core/src`, CLI command modules, contract tests under `ask-core/tests`, operator docs under `docs/operations`, README documentation.

---

## Context

The OHDER loop spec requires the runtime to trigger refactor governance when entropy impact or architectural pressure crosses a threshold.

Current ASK already has:

- OHDER architect validation during governed slice close.
- Entropy history capture during slice close.
- `EntropyImpactMeasured` and `EntropyTrendChanged` events.
- `ask metrics show --history <n>` for entropy history visibility.
- `ask next` fallback decisions that can recommend `create-refactor-slice`.

Current gap:

- `ask next` can recommend a refactor slice, but ASK cannot yet convert the OHDER recommendation into a concrete governed ASK task.
- Refactor confidence levels from the spec are not materialized as policy-governed behavior.
- Operators do not have a preview, create, approve, or reject flow for autonomous refactor recommendations.
- Refactor governance events exist in the spec, but the runtime does not yet emit `RefactorSuggested`, `RefactorApproved`, or `RefactorRejected` around materialized recommendations.

Reference spec:

- `docs/ASK/ask_runtime_ohder_loop_integration_spec_v_2_yellow.md`

Primary implementation references:

- `ask-core/src/core/OhderNextActionEngine.js`
- `ask-core/src/core/OhderEntropySnapshotEngine.js`
- `ask-core/src/core/ArchitectRuntime.js`
- `ask-core/src/core/TaskStore.js`
- `ask-core/src/core/EventLedger.js`
- `ask-core/src/cli/index.js`
- `ask-core/src/cli/commands/next.js`
- `ask-core/tests/ohderNextAction.contract.test.mjs`
- `ask-core/tests/nextAction.contract.test.mjs`

---

### Task 1: Add OHDER Refactor Recommendation Engine

**Files:**

- Create: `ask-core/src/core/OhderRefactorRecommendationEngine.js`
- Test: `ask-core/tests/ohderRefactorRecommendation.contract.test.mjs`

**Step 1: Write failing recommendation engine tests**

Create tests proving the engine returns deterministic recommendations for:

- high entropy pressure
- blocking hard-law architecture status
- refactor governance required by architect status
- low architecture score
- healthy architecture state

Expected recommendation shape:

```js
{
  fingerprint: 'sha256-or-stable-hash',
  title: 'Reduce OHDER entropy pressure',
  objective: 'Create a governed refactor slice that reduces architecture entropy.',
  reason: 'OHDER entropy trend is regressing.',
  confidence: 'high',
  targetSignals: ['entropy.trend:regressing'],
  acceptanceCriteria: [
    'Entropy pressure is reduced or explicitly justified.',
    'OHDER architect validation remains non-blocking.',
    'All tests and ASK gates pass.'
  ],
  blocking: false
}
```

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderRefactorRecommendation.contract.test.mjs
```

Expected: fail because `OhderRefactorRecommendationEngine.js` does not exist.

**Step 2: Implement the minimum pure engine**

Create `OhderRefactorRecommendationEngine` with:

```js
recommend({ architect, entropy, policy })
```

Rules:

- Return `null` for healthy architecture and entropy state.
- Blocking architect status creates a `confidence: high` repair recommendation.
- `architect.refactorGovernance.required` creates at least a `confidence: medium` recommendation.
- `entropy.refactorPressure: high` or `entropy.trend: regressing` creates a `confidence: high` recommendation.
- `entropy.refactorPressure: medium` creates a `confidence: medium` recommendation.
- Low score below policy threshold creates a recommendation with score target signals.
- Fingerprints must be deterministic for the same recommendation inputs and must not include timestamps.

**Step 3: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderRefactorRecommendation.contract.test.mjs
```

Expected: all recommendation engine tests pass.

**Step 4: Close through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one small `ASK-Slice` commit for this slice.

---

### Task 2: Materialize Refactor Recommendations Into Governed ASK Tasks

**Files:**

- Create: `ask-core/src/core/OhderRefactorMaterializationRuntime.js`
- Create: `ask-core/src/cli/commands/refactor.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/ohderRefactorMaterialization.contract.test.mjs`

**Step 1: Write failing materialization tests**

Add tests proving:

- preview returns a recommendation without mutating tasks
- create materializes a governed ASK task
- duplicate create is idempotent for the same recommendation fingerprint
- materialized task includes title, objective, reason, target signals, and acceptance criteria
- materialization emits `RefactorSuggested`

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderRefactorMaterialization.contract.test.mjs
```

Expected: fail because the runtime and CLI do not exist.

**Step 2: Implement refactor materialization runtime**

Create `OhderRefactorMaterializationRuntime` with operations:

```js
preview({ architect, entropy, policy })
create({ architect, entropy, policy, requestedBy })
```

Behavior:

- `preview` calls the recommendation engine and returns `{ ok: true, recommendation }`.
- `preview` never writes task state or ledger events.
- `create` creates an ASK task only when a recommendation exists.
- `create` uses a deterministic task id such as `ohder-refactor-<fingerprint-prefix>`.
- `create` writes task metadata that identifies source `ohder-refactor-governance`.
- `create` emits `RefactorSuggested` with recommendation fingerprint and created task id.
- `create` returns the existing task on repeated calls with the same fingerprint.

**Step 3: Add CLI command**

Add:

```bash
ask refactor preview
ask refactor create
```

Expected output fields:

- `ok`
- `mode`
- `recommendation`
- `task` when created
- `events` when emitted

**Step 4: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderRefactorMaterialization.contract.test.mjs
```

Expected: all materialization tests pass.

**Step 5: Close through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one small `ASK-Slice` commit for this slice.

---

### Task 3: Add Refactor Confidence And Approval Governance

**Files:**

- Modify: `ask-core/src/core/OhderRefactorMaterializationRuntime.js`
- Modify: `ask-core/src/cli/commands/refactor.js`
- Test: `ask-core/tests/ohderRefactorMaterialization.contract.test.mjs`

**Step 1: Write failing confidence policy tests**

Add tests proving:

- low confidence recommendations are suggest-only
- medium confidence recommendations create approval-required tasks
- high confidence recommendations can create governed tasks automatically when policy allows
- high confidence recommendations do not auto-create when policy disables automatic materialization
- approval emits `RefactorApproved`
- rejection emits `RefactorRejected`

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderRefactorMaterialization.contract.test.mjs
```

Expected: fail because confidence policy and approval commands are not implemented.

**Step 2: Implement confidence behavior**

Default policy:

```js
{
  refactorGovernance: {
    autoMaterializeHighConfidence: false,
    requireApprovalForMediumConfidence: true,
    lowConfidenceMode: 'suggest-only'
  }
}
```

Behavior:

- `low` returns suggestion only and does not create a task.
- `medium` creates a task marked `approvalRequired: true`.
- `high` creates a task only from explicit `ask refactor create` or when policy allows automatic materialization.
- every created task records `confidence`, `approvalRequired`, and `recommendationFingerprint`.

**Step 3: Add approval CLI commands**

Add:

```bash
ask refactor approve <taskId>
ask refactor reject <taskId> --reason <reason>
```

Behavior:

- approve marks the task approved for execution and emits `RefactorApproved`.
- reject marks the task rejected or blocked and emits `RefactorRejected`.
- both commands are idempotent for repeated approvals or rejections.

**Step 4: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderRefactorMaterialization.contract.test.mjs
```

Expected: all confidence and approval tests pass.

**Step 5: Close through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one small `ASK-Slice` commit for this slice.

---

### Task 4: Integrate Refactor Materialization With `ask next`

**Files:**

- Modify: `ask-core/src/core/OhderNextActionEngine.js`
- Modify: `ask-core/src/cli/commands/next.js`
- Test: `ask-core/tests/ohderNextAction.contract.test.mjs`
- Test: `ask-core/tests/nextAction.contract.test.mjs`

**Step 1: Write failing next-action integration tests**

Add tests proving:

- active and ready tasks still take precedence over refactor materialization recommendations
- when OHDER recommends `create-refactor-slice`, `ask next` includes a concrete `ask refactor preview` or `ask refactor create` command
- `ask next` includes a compact refactor recommendation summary
- `OhderNextActionRecommended` includes the refactor recommendation fingerprint
- no task is created by `ask next` unless policy explicitly allows automatic materialization

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderNextAction.contract.test.mjs
node --test --test-concurrency=1 ask-core/tests/nextAction.contract.test.mjs
```

Expected: fail because `ask next` does not include recommendation details or materialization commands.

**Step 2: Wire recommendation preview into next-action output**

Update `ask next` so that, when OHDER fallback action is `create-refactor-slice`, it:

- calls the refactor recommendation engine with current architect and entropy state
- includes `refactorRecommendation` in output
- sets `recommendedCommand` to `ask refactor preview` by default
- sets `recommendedCommand` to `ask refactor create` only when policy allows automatic high-confidence materialization
- emits recommendation fingerprint in `OhderNextActionRecommended`

**Step 3: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderNextAction.contract.test.mjs
node --test --test-concurrency=1 ask-core/tests/nextAction.contract.test.mjs
```

Expected: all targeted tests pass.

**Step 4: Close through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one small `ASK-Slice` commit for this slice.

---

### Task 5: Document OHDER Refactor Governance Materialization

**Files:**

- Modify: `README.md`
- Modify: `docs/operations/runtime-architecture.md`
- Modify: `docs/operations/operator-playbooks.md`
- Modify: `docs/operations/policy-reference.md`

**Step 1: Update operator-facing docs**

Document:

- OHDER refactor governance purpose
- how entropy pressure becomes a recommendation
- confidence levels: low, medium, high
- default safety posture: preview first, create explicitly
- `RefactorSuggested`, `RefactorApproved`, and `RefactorRejected`
- CLI flow:

```bash
ask next
ask refactor preview
ask refactor create
ask refactor approve <taskId>
ask refactor reject <taskId> --reason <reason>
```

**Step 2: Verify docs text**

Run:

```bash
rg -n "OHDER Refactor|RefactorSuggested|RefactorApproved|RefactorRejected|ask refactor preview|ask refactor create|confidence" README.md docs/operations
```

Expected: all important terms appear in the docs.

**Step 3: Run final checks**

Run:

```bash
npm test
node ask-core/bin/ask.js preflight
node ask-core/bin/ask.js can-commit
node ask-core/bin/ask.js pre-push-check
```

Expected: all pass.

**Step 4: Close through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one small `ASK-Slice` commit for this slice.

---

## Acceptance Criteria

- OHDER can generate deterministic refactor recommendations from architecture and entropy state.
- Operators can preview recommendations without mutating task state.
- Operators can materialize recommendations into governed ASK tasks.
- Duplicate recommendation materialization is idempotent.
- Refactor confidence levels control suggest-only, approval-required, and automatic materialization behavior.
- Refactor approval and rejection produce replayable events.
- `ask next` points operators to the concrete refactor governance command instead of a placeholder task-create command.
- Documentation explains the refactor governance flow and the operator safety model.
- Each implementation slice closes through `ask slice close <taskId>` and produces a small governed commit.
