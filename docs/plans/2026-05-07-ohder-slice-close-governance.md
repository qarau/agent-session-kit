# OHDER Slice Close Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make OHDER governance a mandatory part of the slice-close lifecycle so ASK's normal governed development path validates architectural integrity before auto-complete and auto-commit.

**Architecture:** Keep ASK Runtime, OHDER Runtime, and Projection Runtime separated. `SliceCloseRuntime` should orchestrate the close lifecycle, but architectural assessment must remain delegated to `RuntimeStateEngine`, `ArchitectRuntime`, `OhderLawPackEngine`, and focused OHDER support engines. The first implementation area is not a full soft-law/scoring platform; it is the control-plane integration that ensures every governed slice close can block on OHDER.

**Tech Stack:** Node.js ESM, `node:test`, Git CLI, ASK Core runtime modules under `ask-core/src`, contract tests under `ask-core/tests`.

---

## Context

The yellow OHDER loop spec requires ASK to preserve long-term architectural survivability, not only pass tests. Current ASK has the 16-step continuation loop and OHDER law-pack assessment inside `ask continue`, but the active development flow uses `ask slice close`. Today `ask slice close` can verify, complete, commit, and run pre-push governance without running OHDER.

This plan closes that control-plane gap first.

Reference spec:

- `docs/ASK/ask_runtime_ohder_loop_integration_spec_v_2_yellow.md`

Current implementation references:

- `ask-core/src/core/SliceCloseRuntime.js`
- `ask-core/src/core/RuntimeStateEngine.js`
- `ask-core/src/core/ArchitectRuntime.js`
- `ask-core/src/core/OhderLawPackEngine.js`
- `ask-core/src/core/RefactorGovernanceEngine.js`
- `ask-core/src/core/AutonomousContinuationRuntime.js`
- `ask-core/tests/sliceClose.contract.test.mjs`
- `ask-core/tests/ohderLawPack.contract.test.mjs`

---

### Task 1: Run OHDER Assessment During Slice Close

**Files:**
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `ask-core/tests/sliceClose.contract.test.mjs`

**Step 1: Write the failing test**

Add a test proving `ask slice close <taskId>` blocks before task completion when OHDER reports a blocking architect violation.

Suggested setup:

- create a temp repo with `ask init`
- start a governed session and in-progress task
- make a legitimate slice file change
- corrupt projection continuity or state so `RuntimeStateEngine.hydrate()` reports `continuityValid: false`
- run `ask slice close <taskId>`

Expected:

- command exits non-zero
- payload code is `slice-close-ohder-blocked`
- payload includes `architect.blocking === true`
- task status remains `in-progress`
- no commit is created

**Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/sliceClose.contract.test.mjs
```

Expected: the new test fails because `SliceCloseRuntime` does not run OHDER assessment.

**Step 3: Implement minimal slice-close OHDER gate**

Update `SliceCloseRuntime`:

- instantiate `RuntimeStateEngine`
- instantiate `ArchitectRuntime`
- after full-suite and can-commit checks, but before verification/completion/commit, hydrate runtime state
- run `architectRuntime.assess({ state, slice, execution, validation, policy })`
- use latest execution/validation data from hydrated state when available
- fail with `slice-close-ohder-blocked` if `architect.blocking === true`
- include architect payload in success and failure responses

Do not move task completion earlier. The order must remain:

```text
preflight -> full suite -> can commit -> dirty index guard -> OHDER -> verify -> complete -> commit -> pre-push
```

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/sliceClose.contract.test.mjs
```

Expected: all slice-close contract tests pass.

**Step 5: Commit through ASK**

Close the materialized ASK slice with:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: ASK creates one `ASK-Slice` commit for this slice.

---

### Task 2: Emit Architectural Replayability Events From Slice Close

**Files:**
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `ask-core/tests/sliceClose.contract.test.mjs`
- Possibly modify: `ask-core/src/runtime/projectors/*` only if projections need explicit support

**Step 1: Write the failing test**

Add a test that runs a slice close with OHDER enabled and reads `.ask/runtime/events.ndjson`.

Expected events:

- `ArchitectValidationCompleted`
- `ReplayabilityValidated`
- `ArchitectureViolationDetected` when architect law violations exist

The failure path should still leave the task `in-progress`.

**Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/sliceClose.contract.test.mjs
```

Expected: event assertions fail because slice close does not emit architectural replayability events.

**Step 3: Implement event emission**

Add event emission in `SliceCloseRuntime` using `EventLedger` and `RuntimeProjectionEngine`.

Minimum event payload requirements:

- `taskId`
- `sliceId` or task id
- `architect.status`
- `architect.blocking`
- `architect.lawOutcome`
- `architect.lawViolations`
- `architect.entropyDelta`
- `architect.couplingDelta`
- `architect.replayabilityRisk`

Emit:

- `ArchitectValidationCompleted` after assessment
- `ReplayabilityValidated` when replayability is low/medium and not blocking
- one `ArchitectureViolationDetected` per violation when violations exist

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/sliceClose.contract.test.mjs
```

Expected: event assertions pass.

**Step 5: Commit through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

---

### Task 3: Add Explicit Hard/Soft OHDER Law Taxonomy

**Files:**
- Modify: `ask-core/src/core/OhderLawPackEngine.js`
- Modify: `ask-core/src/fs/Scaffolder.js`
- Modify: `ask-core/tests/ohderLawPack.contract.test.mjs`
- Modify: `docs/operations/policy-reference.md`

**Step 1: Write the failing test**

Add tests proving the law pack supports explicit law classes:

- `lawClass: "hard"` blocks by default
- `lawClass: "soft"` warns by default
- explicit `outcome` can still override default mapping
- exemption behavior still works

**Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderLawPack.contract.test.mjs
```

Expected: explicit law-class behavior is not implemented.

**Step 3: Implement law-class mapping**

Update `OhderLawPackEngine`:

- normalize `lawClass` to `hard`, `soft`, or empty
- default hard-law outcome to `block`
- default soft-law outcome to `warn`
- keep severity defaults for laws without `lawClass`
- include `lawClass` in evaluated violation payloads

Update default OHDER law pack in `Scaffolder`:

- replayability integrity: hard
- validation integrity: hard
- entropy budget: soft or retry-class policy law
- coupling budget: soft or retry-class policy law

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderLawPack.contract.test.mjs
```

Expected: law-pack tests pass.

**Step 5: Commit through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

---

### Task 4: Add Baseline Architecture Score Output

**Files:**
- Create: `ask-core/src/core/ArchitectureScoreEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/tests/ohderLawPack.contract.test.mjs`
- Modify: `docs/operations/runtime-architecture.md`

**Step 1: Write the failing test**

Add a test proving `ArchitectRuntime.assess()` returns a deterministic architecture score payload:

```json
{
  "architectureScore": {
    "overallScore": 91,
    "grade": "A",
    "categories": {
      "ssotIntegrity": 100,
      "replayability": 100,
      "layerDiscipline": 100,
      "durability": 100,
      "testability": 100,
      "security": 100,
      "observability": 100,
      "replaceability": 100
    }
  }
}
```

The exact score can differ, but it must be deterministic and degrade when hard or soft law violations are present.

**Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderLawPack.contract.test.mjs
```

Expected: `architectureScore` is missing.

**Step 3: Implement minimal scoring engine**

Create `ArchitectureScoreEngine`:

- start each weighted category at `100`
- subtract larger penalties for hard-law/blocking violations
- subtract smaller penalties for soft-law/warning violations
- subtract bounded penalties for entropy/coupling/replayability risk
- calculate weighted `overallScore`
- calculate grade `A/B/C/D/F`

Keep this deterministic and intentionally simple. Do not attempt AST-level analysis in this slice.

**Step 4: Re-run targeted verification**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderLawPack.contract.test.mjs
```

Expected: architecture score tests pass.

**Step 5: Commit through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

---

### Task 5: Document OHDER Slice-Close Governance

**Files:**
- Modify: `README.md`
- Modify: `docs/operations/runtime-architecture.md`
- Modify: `docs/operations/operator-playbooks.md`
- Modify: `docs/operations/policy-reference.md`

**Step 1: Write documentation checklist**

Document:

- `ask slice close` now runs OHDER before auto-complete and auto-commit
- blocking architect violations keep the task `in-progress`
- hard vs soft laws
- baseline architecture score
- how to inspect status with `ask architect status` and `ask governance explain`
- how to use architect exemptions safely

**Step 2: Run docs/reference checks**

Run:

```bash
rg -n "slice close|OHDER|architect|hard law|soft law|architecture score" README.md docs/operations
```

Expected: docs contain the updated operator guidance.

**Step 3: Run full verification**

Run:

```bash
npm test
node ask-core/bin/ask.js preflight
node ask-core/bin/ask.js can-commit
node ask-core/bin/ask.js pre-push-check
```

Expected: all tests and governance gates pass.

**Step 4: Commit through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

---

## Final Verification

Run:

```bash
npm test
node ask-core/bin/ask.js preflight
node ask-core/bin/ask.js can-commit
node ask-core/bin/ask.js pre-push-check
node ask-core/bin/ask.js governance status
node ask-core/bin/ask.js architect status
```

Expected:

- all contract tests pass
- slice close has OHDER in its runtime response
- architect status is updated by slice close
- hard OHDER violations block before completion/commit
- each implementation slice is committed separately with `ASK-Slice`

## Recommended Execution Order

1. OHDER assessment gate in `ask slice close`
2. architectural replayability events
3. hard/soft law taxonomy
4. architecture score payload
5. documentation and operator guidance
