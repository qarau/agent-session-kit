# OHDER Entropy Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make OHDER architecture health measurable, replayable, and trend-aware across governed slice-close work.

**Architecture:** Add a focused entropy snapshot engine that converts architect results and drift analytics into deterministic entropy telemetry. Wire slice-close to capture entropy history because slice-close is the normal governed development path. Then upgrade OHDER next-action decisions so worsening entropy can recommend refactor or governance validation even when the latest architect status is non-blocking.

**Tech Stack:** Node.js ESM, `node:test`, ASK Core runtime modules under `ask-core/src`, contract tests under `ask-core/tests`, docs under `docs/operations`.

---

## Context

The yellow OHDER loop spec requires entropy control across autonomous evolution:

- measure entropy impact
- track coupling and replayability trends
- expose whether architecture is improving, stable, or regressing
- trigger refactor governance when entropy worsens

Current ASK already has:

- `ArchitectRuntime` with `entropyDelta`, `couplingDelta`, `replayabilityRisk`, and `architectureScore`
- `RuntimeDriftAnalyticsEngine` for loop metrics history
- `MetricsWriter` for metrics history and drift analytics files
- `ask slice close` with OHDER architect validation
- `ask next` with OHDER fallback decisions

Current gap:

- slice-close OHDER results do not write entropy history
- `ask metrics show --history` remains empty after slice-close-only work
- OHDER next actions do not use trend pressure from entropy history

Reference spec:

- `docs/ASK/ask_runtime_ohder_loop_integration_spec_v_2_yellow.md`

Primary implementation references:

- `ask-core/src/core/SliceCloseRuntime.js`
- `ask-core/src/core/ArchitectRuntime.js`
- `ask-core/src/core/RuntimeMetricsEngine.js`
- `ask-core/src/core/RuntimeDriftAnalyticsEngine.js`
- `ask-core/src/core/MetricsWriter.js`
- `ask-core/src/core/OhderNextActionEngine.js`
- `ask-core/src/cli/commands/next.js`
- `ask-core/tests/sliceClose.contract.test.mjs`
- `ask-core/tests/ohderNextAction.contract.test.mjs`
- `ask-core/tests/nextAction.contract.test.mjs`

---

### Task 1: Add Entropy Snapshot Engine

**Files:**

- Create: `ask-core/src/core/OhderEntropySnapshotEngine.js`
- Test: `ask-core/tests/ohderEntropy.contract.test.mjs`

**Step 1: Write failing entropy engine tests**

Create tests proving the engine returns deterministic snapshots for:

- healthy architect status
- high replayability risk
- low architecture score
- regressing drift analytics
- refactor pressure calculation

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderEntropy.contract.test.mjs
```

Expected: fail because `OhderEntropySnapshotEngine.js` does not exist.

**Step 2: Implement the minimum pure engine**

Create `OhderEntropySnapshotEngine` with:

```js
snapshot({ architect, previousArchitect, driftAnalytics, policy })
```

Return shape:

```js
{
  entropyScore: 0.18,
  trend: 'stable',
  couplingTrend: 'stable',
  replayabilityTrend: 'stable',
  architectureScore: 99,
  architectureScoreDelta: 0,
  refactorPressure: 'none',
  blocking: false,
  measuredAt: '<iso>'
}
```

Minimum deterministic rules:

- `entropyScore` increases with `entropyDelta`, `couplingDelta`, high replayability risk, and low architecture score.
- `trend` prefers `driftAnalytics.overall.trend` when present.
- `couplingTrend` and `replayabilityTrend` come from `driftAnalytics.architecture`.
- `architectureScoreDelta` compares current and previous overall scores when previous exists.
- `refactorPressure` is `high` for blocking architect status, regressing trend, high replayability risk, or score below policy threshold; `medium` for warning score decay; otherwise `none`.

**Step 3: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderEntropy.contract.test.mjs
```

Expected: all entropy engine tests pass.

**Step 4: Commit through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one `ASK-Slice` commit for this slice.

---

### Task 2: Capture Entropy During Slice Close

**Files:**

- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `ask-core/tests/sliceClose.contract.test.mjs`
- Possibly modify: `ask-core/src/core/MetricsWriter.js` only if a small helper is needed

**Step 1: Write failing slice-close entropy tests**

Add tests proving successful `ask slice close <taskId>`:

- emits `EntropyImpactMeasured`
- emits `EntropyTrendChanged`
- appends a metrics-history entry with entropy, coupling, replayability risk, architecture score, and source `slice-close`
- updates drift analytics so `ask metrics show --history 1` includes the slice-close history entry

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/sliceClose.contract.test.mjs
```

Expected: fail because slice-close does not capture entropy history.

**Step 2: Implement slice-close entropy capture**

After OHDER architect assessment and replayability events, but before verification/completion/commit:

- read previous architect status or latest metrics history as baseline
- build an entropy snapshot with `OhderEntropySnapshotEngine`
- append a metrics-history entry through `MetricsWriter`
- recompute drift analytics with `RuntimeDriftAnalyticsEngine`
- write metrics summary fields: `architectureDriftScore`, `driftTrend`, `driftWindowSize`, and latest entropy snapshot fields if needed
- emit `EntropyImpactMeasured`
- emit `EntropyTrendChanged` when current trend differs from previous stored trend or when this is the first slice-close entropy record

Do not block slice-close in this task. This slice only records entropy evidence.

**Step 3: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/sliceClose.contract.test.mjs
```

Expected: all slice-close contract tests pass.

**Step 4: Commit through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one `ASK-Slice` commit for this slice.

---

### Task 3: Make OHDER Next Use Entropy Trends

**Files:**

- Modify: `ask-core/src/core/OhderNextActionEngine.js`
- Modify: `ask-core/src/cli/commands/next.js`
- Modify: `ask-core/tests/ohderNextAction.contract.test.mjs`
- Modify: `ask-core/tests/nextAction.contract.test.mjs`

**Step 1: Write failing next-action tests**

Add tests proving:

- active and ready tasks still take precedence over entropy recommendations
- high entropy refactor pressure returns `create-refactor-slice`
- regressing entropy trend returns `create-refactor-slice`
- medium entropy pressure returns `run-governance-validation`
- healthy entropy keeps `await-new-requirement`
- `ask next` payload includes a compact `entropy` summary when OHDER fallback is used

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderNextAction.contract.test.mjs
node --test --test-concurrency=1 ask-core/tests/nextAction.contract.test.mjs
```

Expected: fail because `ask next` does not read entropy history or pass entropy snapshots into the next-action engine.

**Step 2: Wire entropy into OHDER next decisions**

Update `OhderNextActionEngine.decide(...)` to accept:

```js
entropy
```

Decision precedence:

1. active or ready tasks return `null`
2. blocking architect status returns `resolve-architecture-block`
3. refactor governance required returns `create-refactor-slice`
4. entropy `refactorPressure: high` or `trend: regressing` returns `create-refactor-slice`
5. entropy `refactorPressure: medium` returns `run-governance-validation`
6. existing replayability/score/governance checks run
7. otherwise `await-new-requirement`

Update `ask next` to:

- read latest drift analytics/history with `MetricsWriter`
- compute an entropy snapshot with `OhderEntropySnapshotEngine`
- pass it to `OhderNextActionEngine`
- include `entropy` in the output payload and `OhderNextActionRecommended` event payload

**Step 3: Run targeted tests**

Run:

```bash
node --test --test-concurrency=1 ask-core/tests/ohderNextAction.contract.test.mjs
node --test --test-concurrency=1 ask-core/tests/nextAction.contract.test.mjs
```

Expected: all targeted tests pass.

**Step 4: Commit through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one `ASK-Slice` commit for this slice.

---

### Task 4: Document OHDER Entropy Runtime

**Files:**

- Modify: `README.md`
- Modify: `docs/operations/runtime-architecture.md`
- Modify: `docs/operations/operator-playbooks.md`
- Modify: `docs/operations/policy-reference.md`

**Step 1: Update operator-facing docs**

Document:

- entropy runtime purpose
- `EntropyImpactMeasured`
- `EntropyTrendChanged`
- how slice-close feeds entropy history
- how `ask next` uses entropy to choose `create-refactor-slice`, `run-governance-validation`, or `await-new-requirement`
- how operators inspect entropy using `ask metrics show --history <n>`

**Step 2: Verify docs text**

Run:

```bash
rg -n "OHDER Entropy|EntropyImpactMeasured|EntropyTrendChanged|refactorPressure|entropyScore|ask metrics show --history" README.md docs/operations
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

**Step 4: Commit through ASK**

Close the materialized ASK slice:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Expected: one `ASK-Slice` commit for this slice.

---

## Acceptance Criteria

- OHDER has a deterministic entropy snapshot engine.
- Slice-close writes entropy history and replayable entropy events.
- `ask metrics show --history <n>` includes slice-close OHDER entropy data.
- `ask next` uses entropy trend/refactor pressure when no task is active or ready.
- Documentation explains the entropy runtime and operator response model.
- Each implementation slice closes through `ask slice close <taskId>` and produces a small governed commit.

