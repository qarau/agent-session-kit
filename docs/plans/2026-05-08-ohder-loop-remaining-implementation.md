# OHDER Loop Remaining Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining runtime work from `ask_runtime_ohder_loop_integration_spec_v_2_yellow.md` so OHDER moves from architecture observability toward enforceable autonomous architectural governance.

**Architecture:** Keep ASK, OHDER, and Projection as separate runtimes. Add policy-driven OHDER modes, expand hard-law enforcement, improve entropy dimensions, make slice close emit loop parity, and ensure refactor outcomes are measured rather than merely suggested.

**Tech Stack:** Node.js ESM, ASK runtime CLI, event ledger, projection snapshots, OHDER architect runtime, node:test contract tests, markdown operations docs.

---

## Current State Summary

Implemented:

- 16-step autonomous loop state machine exists for `ask continue`.
- `ask slice close` runs OHDER validation, entropy capture, auto completion, auto commit, and pre-push governance.
- OHDER law pack supports hard and soft law classes.
- Architecture scoring exists with SSoT, replayability, layer discipline, durability, testability, security, observability, and replaceability categories.
- Entropy history and drift analytics exist.
- Coupling, durability, authority, and complexity analyzers exist.
- Refactor recommendation, target discovery, materialization, approval/rejection, and execution planning exist.
- `ask next` can emit OHDER-driven next actions.

Remaining work:

- Runtime modes are not first-class OHDER controls.
- Several hard-law categories are not enforced by default.
- Analyzer findings mostly affect score rather than blocking.
- Entropy dimensions do not yet track SSoT, durability, complexity, duplication, observability, or refactor health trends.
- `ask slice close` does not write the same 16-step loop-state/evidence sequence as `ask continue`.
- Requirement analysis is shallow.
- Interactive Codex sessions are governed mainly at slice close unless explicitly launched through ASK.
- Refactor success is not measured as a before/after gate.
- Architectural replay event taxonomy is incomplete.
- Security boundary governance is not implemented deeply.
- Future IDEA/council/autonomous entropy features need explicit deferral boundaries.
- Analyzer path normalization has known defects.

---

## Slice 001: Fix Analyzer Path Normalization

**Purpose:** Remove known false paths like `sk-core/...` before stricter enforcement depends on analyzer output.

**Files:**

- Modify: `ask-core/src/core/OhderCouplingAnalyzerEngine.js`
- Modify: `ask-core/src/core/OhderDurabilityValidatorEngine.js`
- Modify: `ask-core/src/core/OhderAuthorityAnalyzerEngine.js`
- Modify: `ask-core/src/core/OhderComplexityAnalyzerEngine.js`
- Test: `ask-core/tests/ohderAnalyzerPathNormalization.contract.test.mjs`

**Steps:**

1. Write failing tests for touched file paths with leading `ask-core/...`.
2. Verify analyzer outputs preserve `ask-core/...` and never truncate to `sk-core/...`.
3. Add shared path normalization helper or local fixes.
4. Run analyzer contracts.
5. Run `node --test ask-core/tests/ohder*Analyzer*.test.mjs`.
6. Close with `ask slice close ohloop-001`.

**Acceptance Criteria:**

- Analyzer output never drops the first character of a relative path.
- All analyzer findings use normalized slash paths.
- Existing analyzer contracts still pass.

---

## Slice 002: Add OHDER Runtime Modes

**Purpose:** Implement `fast`, `strict`, and `refactor` as first-class OHDER governance modes.

**Files:**

- Modify: `ask-core/src/policy/defaultPolicy.js`
- Modify: `ask-core/src/core/PolicyEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `docs/operations/policy-reference.md`
- Test: `ask-core/tests/ohderRuntimeModes.contract.test.mjs`

**Mode Semantics:**

- `fast`: hard laws still block, soft laws warn, analyzer risks are telemetry unless already hard-law mapped.
- `strict`: configured hard law mappings block slice close.
- `refactor`: non-refactor feature work is blocked or warned based on policy, and refactor tasks get stronger before/after entropy checks.

**Steps:**

1. Write failing policy parser tests for `ohder.mode: fast|strict|refactor`.
2. Write failing architect tests showing the selected mode appears in architect status.
3. Write failing slice-close tests showing strict mode can block on hard analyzer findings.
4. Implement default policy keys.
5. Normalize mode in `PolicyEngine`.
6. Surface `ohderMode` in `ArchitectRuntime` payload.
7. Route mode-specific block behavior through `SliceCloseRuntime`.
8. Update policy docs.
9. Run targeted mode tests.
10. Close with `ask slice close ohloop-002`.

**Acceptance Criteria:**

- Runtime mode is deterministic and documented.
- Architect status includes selected `ohderMode`.
- `strict` can block on hard findings.
- `fast` preserves current warning-first behavior.

---

## Slice 003: Expand Hard Law Enforcement

**Purpose:** Convert spec hard-law categories into enforceable law-pack defaults and architect facts.

**Files:**

- Modify: `ask-core/src/fs/Scaffolder.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/OhderLawPackEngine.js`
- Modify: `docs/operations/policy-reference.md`
- Test: `ask-core/tests/ohderHardLawCoverage.contract.test.mjs`

**Hard Laws To Add:**

- `ProjectionAuthority`
- `SSoTIntegrity`
- `Replayability`
- `SecurityBoundary`
- `LayerIsolation`
- `EventOnlySync`
- `DurabilityIntegrity`

**Steps:**

1. Write failing scaffold tests proving default law pack includes all hard-law categories.
2. Write failing law evaluation tests for each metric.
3. Add architect facts for authority, layer isolation, durability, and security placeholders.
4. Add default hard laws with `lawClass: "hard"` and block outcomes.
5. Keep existing replayability and validation laws compatible.
6. Run law-pack and architect tests.
7. Close with `ask slice close ohloop-003`.

**Acceptance Criteria:**

- Default law pack declares each spec hard-law category.
- Hard-law violations block unless exempted.
- Exemption behavior remains deterministic.

---

## Slice 004: Map Analyzer Findings To Hard/Soft Laws

**Purpose:** Make analyzer output enforceable through law facts instead of score-only telemetry.

**Files:**

- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/OhderCouplingAnalyzerEngine.js`
- Modify: `ask-core/src/core/OhderDurabilityValidatorEngine.js`
- Modify: `ask-core/src/core/OhderAuthorityAnalyzerEngine.js`
- Modify: `ask-core/src/core/OhderComplexityAnalyzerEngine.js`
- Test: `ask-core/tests/ohderAnalyzerLawMapping.contract.test.mjs`

**Mapping:**

- Core-to-CLI or forbidden layer bypass maps to `layer_isolation: invalid`.
- Direct governed state write maps to `projection_authority: invalid`.
- High durability risk maps to `durability_integrity: at-risk`.
- High complexity maps to `srp_integrity: weak`.

**Steps:**

1. Write failing tests for strict-mode analyzer findings producing law violations.
2. Add normalized fact outputs from analyzer results.
3. Evaluate facts through the law pack.
4. Keep soft findings warning-level in fast mode.
5. Run analyzer and law-pack contracts.
6. Close with `ask slice close ohloop-004`.

**Acceptance Criteria:**

- Analyzer findings can become law violations.
- Strict mode blocks hard analyzer violations.
- Soft analyzer risks lower scores but do not block.

---

## Slice 005: Expand Entropy Dimensions

**Purpose:** Track the entropy dimensions named in the spec, not only generic entropy/coupling/replayability.

**Files:**

- Modify: `ask-core/src/core/OhderEntropySnapshotEngine.js`
- Modify: `ask-core/src/core/RuntimeDriftAnalyticsEngine.js`
- Modify: `ask-core/src/core/MetricsWriter.js`
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `ask-core/src/core/RuntimeMetricsEngine.js`
- Test: `ask-core/tests/ohderEntropyDimensions.contract.test.mjs`

**New Dimensions:**

- `ssotViolationTrend`
- `durabilityTrend`
- `complexityTrend`
- `duplicationTrend`
- `observabilityTrend`
- `refactorHealthTrend`

**Steps:**

1. Write failing entropy snapshot tests for new fields.
2. Write failing drift analytics tests for trend windows.
3. Derive trends from architect analyzer output and history.
4. Persist fields in metrics history.
5. Surface fields in `ask metrics show`.
6. Run entropy, metrics, and next-action tests.
7. Close with `ask slice close ohloop-005`.

**Acceptance Criteria:**

- Metrics history includes all new entropy dimensions.
- Drift analytics computes stable/increasing/decreasing trends for each dimension.
- `ask next` can use relevant new dimensions without breaking existing behavior.

---

## Slice 006: Add Slice-Close 16-Step Loop Parity

**Purpose:** Make `ask slice close` record the same loop step semantics as `ask continue`.

**Files:**

- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `ask-core/src/core/AutonomousLoopStateMachine.js`
- Test: `ask-core/tests/sliceCloseLoopParity.contract.test.mjs`

**Steps:**

1. Write failing tests that `ask slice close` writes loop-state history.
2. Record steps 8 through 16 during slice close.
3. Record hydration/context steps where available.
4. Emit `AutonomousLoopStepEntered` events for slice-close governance.
5. Ensure loop-state completion decision is `continue`, `block`, or `retry`.
6. Run slice-close tests.
7. Close with `ask slice close ohloop-006`.

**Acceptance Criteria:**

- Slice close writes `.ask/runtime/loop-state.json`.
- Slice close emits loop-step replay events.
- Blocking slice close records decision `block`.
- Successful slice close records decision `continue`.

---

## Slice 007: Add Requirement Analyzer Runtime

**Purpose:** Implement step 2 and step 3 more deeply by classifying requirements before intent and slice creation.

**Files:**

- Create: `ask-core/src/core/RequirementAnalyzerEngine.js`
- Modify: `ask-core/src/core/AutonomousContinuationRuntime.js`
- Modify: `ask-core/src/core/IntentEngine.js`
- Modify: `ask-core/src/core/SlicePlanner.js`
- Test: `ask-core/tests/requirementAnalyzer.contract.test.mjs`

**Requirement Signals:**

- feature
- bugfix
- refactor
- docs
- governance
- release
- security-sensitive
- durability-sensitive

**Steps:**

1. Write failing tests for requirement classification.
2. Add deterministic text and task metadata classifier.
3. Attach requirement analysis to `IntentSelected`.
4. Use analysis in slice planning.
5. Make security/durability flags visible to OHDER.
6. Run continuation and next-action tests.
7. Close with `ask slice close ohloop-007`.

**Acceptance Criteria:**

- Runtime emits requirement analysis.
- Slice metadata includes requirement class.
- OHDER can use requirement risk flags.

---

## Slice 008: Enforce Governed Codex Session Coverage

**Purpose:** Reduce the gap where interactive Codex work is only governed at slice close unless launched through ASK.

**Files:**

- Modify: `ask-core/src/core/CodexLaunchRuntime.js`
- Modify: `ask-core/src/core/PreCommitCheckEngine.js`
- Modify: `ask-core/src/core/PrePushCheckEngine.js`
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `docs/operations/operator-playbooks.md`
- Test: `ask-core/tests/codexGovernedCoverage.contract.test.mjs`

**Steps:**

1. Write failing tests for detecting code changes without a governed Codex launch or explicit interactive-session evidence.
2. Add an explicit `ask codex checkpoint` or evidence marker requirement.
3. Let slice close accept governed launch evidence or interactive checkpoint evidence.
4. Keep manual developer workflows possible with explicit governance evidence.
5. Document the expected operator flow.
6. Run codex launch, pre-commit, pre-push, and slice-close tests.
7. Close with `ask slice close ohloop-008`.

**Acceptance Criteria:**

- ASK can distinguish governed launch work from interactive work.
- Interactive work needs explicit checkpoint evidence before close.
- Existing hooks remain non-forging and fail-closed.

---

## Slice 009: Enforce Refactor Outcome Validation

**Purpose:** Ensure refactor tasks prove entropy reduction or explicitly justify why reduction is not immediate.

**Files:**

- Create: `ask-core/src/core/OhderRefactorOutcomeEngine.js`
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `ask-core/src/core/OhderRefactorMaterializationRuntime.js`
- Modify: `docs/operations/operator-playbooks.md`
- Test: `ask-core/tests/ohderRefactorOutcome.contract.test.mjs`

**Steps:**

1. Write failing tests for refactor task close without outcome evidence.
2. Capture before/after architect and entropy snapshots for refactor tasks.
3. Pass if entropy/score improves.
4. Warn or require justification if entropy worsens.
5. Block in `refactor` mode when no improvement and no justification exists.
6. Run refactor materialization and slice-close tests.
7. Close with `ask slice close ohloop-009`.

**Acceptance Criteria:**

- Refactor tasks include outcome evidence.
- Worsening refactor outcomes are visible and policy-governed.
- Refactor mode can block unjustified entropy regression.

---

## Slice 010: Standardize Architectural Replay Events

**Purpose:** Align event taxonomy with the spec for better replayability.

**Files:**

- Modify: `ask-core/src/core/AutonomousContinuationRuntime.js`
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Modify: `ask-core/src/core/CodexLaunchRuntime.js`
- Modify: `ask-core/src/core/ValidationIntelligenceEngine.js`
- Test: `ask-core/tests/architecturalReplayEvents.contract.test.mjs`

**Events:**

- `CodeWritten`
- `TestPassed`
- `TestFailed`
- `ArchitectureScoreCalculated`
- `GovernanceGateBlocked`
- Existing events must remain backward compatible.

**Steps:**

1. Write failing event-ledger tests for event emission.
2. Emit `CodeWritten` when touched files are captured.
3. Emit `TestPassed` or `TestFailed` from validation.
4. Emit `ArchitectureScoreCalculated` during architect assessment.
5. Alias or add `GovernanceGateBlocked` for OHDER/flow blocks.
6. Update event docs.
7. Run replay and continuation tests.
8. Close with `ask slice close ohloop-010`.

**Acceptance Criteria:**

- New events appear in ledger.
- Existing projections remain compatible.
- Replay proof still passes.

---

## Slice 011: Add Security Boundary Analyzer

**Purpose:** Implement the missing security boundary governance category.

**Files:**

- Create: `ask-core/src/core/OhderSecurityBoundaryAnalyzerEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/ArchitectureScoreEngine.js`
- Modify: `ask-core/src/fs/Scaffolder.js`
- Test: `ask-core/tests/ohderSecurityBoundaryAnalyzer.contract.test.mjs`

**Initial Signals:**

- auth files touched without tests
- route/API/security files touched
- policy bypass strings
- secrets or token handling code changed
- direct provider allowlist bypass

**Steps:**

1. Write failing tests for security-sensitive file changes.
2. Add deterministic analyzer.
3. Expose `securityAnalysis` in architect status.
4. Feed security risk into `security` score category.
5. Map high risk to `security_boundary: invalid` in strict mode.
6. Run architect and law-pack tests.
7. Close with `ask slice close ohloop-011`.

**Acceptance Criteria:**

- Architect status includes `securityAnalysis`.
- Security findings affect score.
- Strict mode can block security boundary violations.

---

## Slice 012: Implement Runtime Mode CLI And Operator Visibility

**Purpose:** Make OHDER mode and current governance posture visible to operators.

**Files:**

- Modify: `ask-core/src/cli/commands/architect.js`
- Modify: `ask-core/src/cli/commands/governance.js`
- Modify: `ask-core/src/core/RuntimeStateEngine.js`
- Modify: `docs/operations/operator-playbooks.md`
- Test: `ask-core/tests/ohderRuntimeModeCli.contract.test.mjs`

**Steps:**

1. Write failing CLI tests for architect/governance status showing OHDER mode.
2. Surface mode in project-state and governance explain.
3. Add operator guidance for switching modes by policy.
4. Run CLI tests.
5. Close with `ask slice close ohloop-012`.

**Acceptance Criteria:**

- Operators can see current OHDER mode.
- Governance explanation includes mode-specific behavior.
- Docs explain when to use fast, strict, or refactor.

---

## Slice 013: Document Future Evolution Boundaries

**Purpose:** Separate implemented runtime commitments from future IDEA/council/autonomous entropy aspirations.

**Files:**

- Modify: `README.md`
- Modify: `docs/operations/runtime-architecture.md`
- Modify: `docs/operations/operator-playbooks.md`
- Create: `docs/operations/future-ohder-runtime.md`

**Topics:**

- IDEA-aware runtime
- Architectural councils
- Autonomous entropy reduction
- High-confidence autonomous patch application

**Steps:**

1. Move future concepts into a dedicated future runtime doc.
2. Add clear status labels: implemented, partial, planned, future.
3. Keep README focused on current operator capabilities.
4. Run docs freshness checks.
5. Close with `ask slice close ohloop-013`.

**Acceptance Criteria:**

- Current docs do not imply future features are already available.
- Future features have explicit implementation prerequisites.
- Operator docs remain actionable.

---

## Execution Order

1. `ohloop-001`: Path normalization reliability.
2. `ohloop-002`: Runtime modes.
3. `ohloop-003`: Hard-law coverage.
4. `ohloop-004`: Analyzer-to-law mapping.
5. `ohloop-005`: Entropy dimensions.
6. `ohloop-006`: Slice-close loop parity.
7. `ohloop-007`: Requirement analyzer.
8. `ohloop-008`: Governed Codex session coverage.
9. `ohloop-009`: Refactor outcome validation.
10. `ohloop-010`: Architectural replay events.
11. `ohloop-011`: Security boundary analyzer.
12. `ohloop-012`: Mode CLI visibility.
13. `ohloop-013`: Future evolution docs.

---

## Validation Strategy

Run targeted tests after each slice.

Run full suite after every integrator slice:

```bash
npm test
```

Close every slice with:

```bash
node ask-core/bin/ask.js slice close <taskId>
```

Every implementation commit must be created by ASK slice close with:

```text
ASK-Slice: <taskId>
```

---

## ASK Ingestion

Use the paired JSON plan:

```bash
node ask-core/bin/ask.js plan validate --task ohder-loop-remaining-plan --run-id ohder-loop-remaining-2026-05-08 --path docs/plans/ohder-loop-remaining.plan.json
node ask-core/bin/ask.js plan ingest --task ohder-loop-remaining-plan --run-id ohder-loop-remaining-2026-05-08 --path docs/plans/ohder-loop-remaining.plan.json
```

