# OHDER Semantic Autonomy Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make OHDER smarter, more semantic, and more autonomous while preserving ASK's separation between execution, governance, and projection runtimes.

**Architecture:** Keep ASK as the execution lifecycle runtime, OHDER as the architecture governance runtime, and Projection as the replay/continuity runtime. Add semantic fact envelopes first, then deeper analyzers, then policy-driven mode profiles, then bounded autonomous governance actions that can recommend or materialize work without silently applying broad patches.

**Tech Stack:** Node.js ESM, ASK CLI, `.ask` runtime state, EventLedger, RuntimeProjectionEngine, ArchitectRuntime, OHDER law pack, node:test contract tests, markdown operations docs.

---

## Current Baseline

Implemented before this plan:

- OHDER runs during `ask slice close <taskId>`.
- Hard/soft OHDER laws exist in `.ask/policy/ohder-law-pack.json`.
- OHDER modes exist: `fast`, `strict`, `refactor`.
- Architecture score exists.
- Entropy history and drift analytics exist.
- Deep analyzers exist for coupling, durability, authority, complexity/SRP, and security boundary.
- OHDER-driven `ask next` exists.
- Refactor recommendation, target discovery, execution planning, materialization, approval/rejection, and outcome validation exist.
- Architectural replay events exist.
- Current/partial/planned/future OHDER boundaries are documented.

Remaining maturity target:

- Move from path/content heuristics to semantic fact envelopes with confidence, evidence, and source traces.
- Add missing analyzers for SSoT, event-only sync, duplication, observability, testability, YAGNI, and replaceability.
- Make `strict` and `refactor` modes meaningfully deeper than `fast`.
- Add a mutating governance validation command that refreshes governance state.
- Make autonomous entropy reduction able to create ranked, bounded remediation work without applying unsafe patches.

---

## Slice 001: Semantic Fact Envelope Runtime

**Purpose:** Create a shared OHDER fact model so analyzers emit structured semantic evidence instead of unrelated ad hoc fields.

**Files:**

- Create: `ask-core/src/core/OhderSemanticFactEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/ArchitectureScoreEngine.js`
- Test: `ask-core/tests/ohderSemanticFact.contract.test.mjs`
- Docs: `docs/operations/runtime-architecture.md`

**Fact Envelope Shape:**

```js
{
  factId: 'security-boundary:auth-token-handler',
  metric: 'security_boundary',
  value: 'invalid',
  confidence: 'high',
  severity: 'critical',
  source: 'OhderSecurityBoundaryAnalyzerEngine',
  evidence: [
    {
      filePath: 'src/auth/AuthTokenHandler.js',
      reason: 'auth bypass signal detected',
      lineHint: 'skipAuth'
    }
  ],
  recommendations: ['Add authorization guard tests before close.']
}
```

**Steps:**

1. Write failing tests for fact normalization, confidence coercion, deduplication, and evidence preservation.
2. Run `node --test ask-core/tests/ohderSemanticFact.contract.test.mjs` and verify RED.
3. Implement `OhderSemanticFactEngine.normalizeFacts()`.
4. Wire `ArchitectRuntime` to collect `semanticFacts` from analyzer output.
5. Ensure law-pack facts still expose the current flat `ohderFacts` map for compatibility.
6. Run `node --test ask-core/tests/ohderSemanticFact.contract.test.mjs ask-core/tests/ohderLawPack.contract.test.mjs`.
7. Update runtime architecture docs.
8. Close with `node ask-core/bin/ask.js slice close ohsmart-001`.

**Acceptance Criteria:**

- Architect status includes `semanticFacts`.
- Existing `ohderFacts` remains backward compatible.
- Each semantic fact has metric, value, confidence, source, evidence, and recommendations.

---

## Slice 002: SSoT Semantic Analyzer

**Purpose:** Detect duplicate authorities for the same governed state, projection, policy, session, task, or runtime snapshot.

**Files:**

- Create: `ask-core/src/core/OhderSsotAnalyzerEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/ArchitectureScoreEngine.js`
- Test: `ask-core/tests/ohderSsotAnalyzer.contract.test.mjs`
- Docs: `docs/operations/ohder-analyzer-playbook.md`

**Detection Scope:**

- Multiple files writing the same `.ask/runtime/snapshots/*` artifact.
- Runtime state writes outside approved authority files.
- Duplicate task/session/projection authority patterns.
- Conflicting policy defaults across scaffolder and policy source.

**Steps:**

1. Write failing tests where two files both write `taskBoardSnapshot`.
2. Write failing tests where approved projection authority remains valid.
3. Run the new test and verify RED.
4. Implement `OhderSsotAnalyzerEngine`.
5. Emit semantic facts for `ssot_integrity`.
6. Map invalid SSoT facts to architecture score penalties and hard-law evaluation.
7. Run `node --test ask-core/tests/ohderSsotAnalyzer.contract.test.mjs ask-core/tests/ohderHardLawCoverage.contract.test.mjs`.
8. Update analyzer playbook with SSoT response guidance.
9. Close with `node ask-core/bin/ask.js slice close ohsmart-002`.

**Acceptance Criteria:**

- Duplicate governed-state authority produces `ssot_integrity: invalid`.
- Approved authority paths remain valid.
- Strict mode blocks SSoT hard-law violations.

---

## Slice 003: Event-Only Sync Analyzer

**Purpose:** Detect direct synchronization/state overwrite paths that bypass event-ledger or projection authority.

**Files:**

- Create: `ask-core/src/core/OhderEventOnlySyncAnalyzerEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/ArchitectureScoreEngine.js`
- Test: `ask-core/tests/ohderEventOnlySyncAnalyzer.contract.test.mjs`
- Docs: `docs/operations/ohder-analyzer-playbook.md`

**Detection Scope:**

- Direct cloud/database overwrite functions in runtime/core files.
- Snapshot writes that bypass EventLedger or RuntimeProjectionEngine.
- Sync adapters mutating projected state without replayable event evidence.

**Steps:**

1. Write failing tests for a direct sync overwrite in a core runtime file.
2. Write failing tests showing EventLedger and approved adapters are allowed.
3. Run the new test and verify RED.
4. Implement analyzer path/content detection.
5. Emit semantic facts for `event_only_sync`.
6. Map facts to hard law in `ArchitectRuntime`.
7. Run event-only sync, law-pack, and architect tests.
8. Update operator playbook.
9. Close with `node ask-core/bin/ask.js slice close ohsmart-003`.

**Acceptance Criteria:**

- Direct non-event sync mutation produces `event_only_sync: invalid`.
- Approved event/projection authorities remain valid.
- Strict mode blocks invalid event-only sync.

---

## Slice 004: Duplication And DRY Analyzer

**Purpose:** Add a deterministic lightweight duplication detector for changed files without attempting whole-codebase clone analysis.

**Files:**

- Create: `ask-core/src/core/OhderDuplicationAnalyzerEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/ArchitectureScoreEngine.js`
- Modify: `ask-core/src/core/OhderEntropySnapshotEngine.js`
- Test: `ask-core/tests/ohderDuplicationAnalyzer.contract.test.mjs`

**Detection Scope:**

- Repeated function bodies in touched files.
- Repeated large line windows.
- Repeated command/validation blocks in runtime code.

**Steps:**

1. Write failing tests for repeated function bodies in two touched files.
2. Write failing tests showing short/common boilerplate does not trigger.
3. Run the new test and verify RED.
4. Implement normalized block hashing with minimum line threshold.
5. Emit semantic facts for `duplication_risk`.
6. Add architecture score penalty for medium/high duplication.
7. Feed duplication risk into entropy history.
8. Run duplication, entropy dimensions, and architect tests.
9. Close with `node ask-core/bin/ask.js slice close ohsmart-004`.

**Acceptance Criteria:**

- Meaningful duplication is reported with file evidence.
- Boilerplate does not create noisy findings.
- Duplication affects score and entropy trend.

---

## Slice 005: Observability Analyzer

**Purpose:** Detect runtime changes that weaken replayability and debugging evidence by adding behavior without events, status fields, or diagnostics.

**Files:**

- Create: `ask-core/src/core/OhderObservabilityAnalyzerEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/ArchitectureScoreEngine.js`
- Modify: `ask-core/src/core/OhderEntropySnapshotEngine.js`
- Test: `ask-core/tests/ohderObservabilityAnalyzer.contract.test.mjs`

**Detection Scope:**

- New runtime decisions without EventLedger emission.
- New blocking paths without diagnostic `code` or `message`.
- New governance state changes without status/explain visibility.

**Steps:**

1. Write failing tests for a runtime branch returning `{ ok: false }` without `code`.
2. Write failing tests for a governance mutation without event emission.
3. Run the new test and verify RED.
4. Implement observability heuristics.
5. Emit semantic facts for `observability_risk`.
6. Penalize observability score and entropy dimension.
7. Run targeted tests.
8. Close with `node ask-core/bin/ask.js slice close ohsmart-005`.

**Acceptance Criteria:**

- Governance/runtime behavior without diagnostics is reported.
- Event-backed and diagnostic-rich changes stay low risk.
- Observability trend appears in entropy history.

---

## Slice 006: Testability Analyzer

**Purpose:** Detect changes that make behavior hard to validate, especially CLI-heavy logic, filesystem-coupled decisions, and untested runtime branches.

**Files:**

- Create: `ask-core/src/core/OhderTestabilityAnalyzerEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/ArchitectureScoreEngine.js`
- Test: `ask-core/tests/ohderTestabilityAnalyzer.contract.test.mjs`

**Detection Scope:**

- New exported runtime behavior without matching contract test.
- Large CLI functions mixing parsing, policy, filesystem, and decision logic.
- Core logic directly coupled to process/global state.

**Steps:**

1. Write failing tests for a touched runtime file with no matching test file.
2. Write failing tests showing changed code with matching contract tests is lower risk.
3. Run the new test and verify RED.
4. Implement analyzer.
5. Emit semantic facts for `testability_risk`.
6. Penalize testability architecture score.
7. Run targeted tests.
8. Close with `node ask-core/bin/ask.js slice close ohsmart-006`.

**Acceptance Criteria:**

- Untested behavior changes are visible in architect status.
- Matching tests reduce risk.
- Score impact is deterministic.

---

## Slice 007: Replaceability And YAGNI Analyzer

**Purpose:** Detect infrastructure leakage and speculative abstractions that make the system harder to evolve.

**Files:**

- Create: `ask-core/src/core/OhderReplaceabilityAnalyzerEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/ArchitectureScoreEngine.js`
- Test: `ask-core/tests/ohderReplaceabilityAnalyzer.contract.test.mjs`

**Detection Scope:**

- Core importing adapters/CLI/infrastructure directly.
- Vendor-specific implementation names in domain/runtime decision logic.
- Abstract factories/interfaces added without current call sites.

**Steps:**

1. Write failing tests for core importing adapter/CLI infrastructure.
2. Write failing tests for speculative abstraction with no usage.
3. Run the new test and verify RED.
4. Implement analyzer.
5. Emit semantic facts for `replaceability_risk` and `yagni_risk`.
6. Penalize replaceability score.
7. Run targeted tests.
8. Close with `node ask-core/bin/ask.js slice close ohsmart-007`.

**Acceptance Criteria:**

- Infrastructure leakage is reported.
- Speculative abstractions are warning-only.
- Replaceability score changes deterministically.

---

## Slice 008: Security Semantic Upgrade

**Purpose:** Move security analysis from basic path/content signals toward explicit auth, permission, token, secret, and route-boundary semantics.

**Files:**

- Modify: `ask-core/src/core/OhderSecurityBoundaryAnalyzerEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Test: `ask-core/tests/ohderSecurityBoundaryAnalyzer.contract.test.mjs`
- Docs: `docs/operations/ohder-analyzer-playbook.md`

**Detection Scope:**

- Auth/token/session route files require matching tests.
- Permission/role/scope changes require explicit authorization evidence.
- Secret/token handling requires no hardcoded credential evidence.
- Bypass signals remain high risk.

**Steps:**

1. Add failing tests for role/scope change without matching authz test.
2. Add failing tests for hardcoded token/secret string.
3. Add tests showing matching authz tests lower risk.
4. Run security tests and verify RED.
5. Upgrade analyzer.
6. Emit richer semantic facts with confidence.
7. Run security, law mapping, and score tests.
8. Close with `node ask-core/bin/ask.js slice close ohsmart-008`.

**Acceptance Criteria:**

- Security findings include auth/authz/token/secret categories.
- Matching security tests lower risk.
- Strict mode blocks high-confidence security boundary violations.

---

## Slice 009: OHDER Mode Profiles

**Purpose:** Make `fast`, `strict`, and `refactor` materially different governance profiles instead of mostly reporting modes.

**Files:**

- Modify: `ask-core/src/policy/defaultPolicy.js`
- Modify: `ask-core/src/core/PolicyEngine.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Modify: `ask-core/src/core/SliceCloseRuntime.js`
- Test: `ask-core/tests/ohderModeProfiles.contract.test.mjs`
- Docs: `docs/operations/policy-reference.md`

**Profile Semantics:**

- `fast`: warning-first; hard laws still block.
- `strict`: requires semantic fact evidence, stricter durability/replay checks, hard-law analyzer blocks.
- `refactor`: feature work is blocked unless explicitly exempted; refactor tasks must improve or justify architecture/entropy outcome.

**Steps:**

1. Write failing tests for policy profile defaults.
2. Write failing tests for strict requiring analyzer evidence on risky code changes.
3. Write failing tests for refactor mode blocking non-refactor slice close.
4. Implement policy profile normalization.
5. Wire profile behavior into `ArchitectRuntime` and `SliceCloseRuntime`.
6. Update policy docs.
7. Run mode profile tests.
8. Close with `node ask-core/bin/ask.js slice close ohsmart-009`.

**Acceptance Criteria:**

- Modes have observable behavioral differences.
- Refactor mode prevents normal feature slices unless policy-exempted.
- Strict mode deepens validation requirements.

---

## Slice 010: Mutating Governance Validation Runtime

**Purpose:** Add an explicit command that refreshes governance evidence, recomputes current architect/entropy state, writes a governance decision, and clears stale validation recommendations when appropriate.

**Files:**

- Create: `ask-core/src/core/GovernanceValidationRuntime.js`
- Modify: `ask-core/src/cli/commands/governance.js`
- Modify: `ask-core/src/cli/index.js`
- Modify: `ask-core/src/core/OhderNextActionEngine.js`
- Test: `ask-core/tests/governanceValidationRuntime.contract.test.mjs`
- Docs: `docs/operations/operator-playbooks.md`

**Command:**

```bash
node ask-core/bin/ask.js governance validate
```

**Steps:**

1. Write failing CLI test where `ask next` recommends `run-governance-validation`.
2. Write failing test that `ask governance validate` writes `GovernanceDecisionWritten`.
3. Write failing test that validation can change next action to `await-new-requirement` when clear.
4. Implement runtime.
5. Wire CLI command.
6. Emit replay events.
7. Update playbook.
8. Run governance validation and next-action tests.
9. Close with `node ask-core/bin/ask.js slice close ohsmart-010`.

**Acceptance Criteria:**

- Governance validation is an explicit mutating runtime action.
- It writes evidence and decision state.
- `ask next` responds to refreshed validation evidence.

---

## Slice 011: Ranked Refactor Target Portfolio

**Purpose:** Move refactor targeting from one candidate to a ranked portfolio with reasons, blast radius, confidence, and freshness.

**Files:**

- Modify: `ask-core/src/core/OhderRefactorTargetDiscoveryEngine.js`
- Modify: `ask-core/src/core/OhderRefactorRecommendationEngine.js`
- Modify: `ask-core/src/cli/commands/refactor.js`
- Test: `ask-core/tests/ohderRefactorTargetPortfolio.contract.test.mjs`
- Docs: `docs/operations/operator-playbooks.md`

**Steps:**

1. Write failing tests for multiple ranked refactor targets.
2. Write tests proving completed target fingerprints are skipped.
3. Add target scores for recurrence, entropy pressure, analyzer severity, and blast radius.
4. Update `ask refactor preview` to show portfolio plus selected target.
5. Preserve existing materialization behavior for selected target.
6. Run refactor target and materialization tests.
7. Close with `node ask-core/bin/ask.js slice close ohsmart-011`.

**Acceptance Criteria:**

- OHDER exposes multiple ranked refactor candidates.
- The selected candidate remains deterministic.
- Completed targets are not repeatedly suggested.

---

## Slice 012: Autonomous Entropy Reduction Controller

**Purpose:** Let ASK create bounded remediation tasks from high-confidence OHDER refactor recommendations under policy, without applying code patches automatically.

**Files:**

- Create: `ask-core/src/core/OhderAutonomousEntropyController.js`
- Modify: `ask-core/src/cli/commands/refactor.js`
- Modify: `ask-core/src/core/OhderNextActionEngine.js`
- Modify: `ask-core/src/policy/defaultPolicy.js`
- Test: `ask-core/tests/ohderAutonomousEntropyController.contract.test.mjs`
- Docs: `docs/operations/policy-reference.md`

**Policy Defaults:**

```yaml
ohder_autonomy:
  auto_create_refactor_tasks: false
  max_auto_created_tasks_per_session: 1
  require_clean_worktree: true
  min_confidence: high
  max_blast_radius: medium
```

**Steps:**

1. Write failing tests showing auto creation is disabled by default.
2. Write failing tests showing policy-enabled high-confidence recommendation creates one task.
3. Write failing tests showing medium/high blast radius requires approval instead of auto creation.
4. Implement controller.
5. Wire `ask refactor create --auto` through controller.
6. Ensure no patches are applied.
7. Run target, materialization, next-action, and autonomy tests.
8. Close with `node ask-core/bin/ask.js slice close ohsmart-012`.

**Acceptance Criteria:**

- OHDER can autonomously create bounded refactor tasks when policy allows.
- It cannot mutate code directly.
- It respects confidence, blast radius, worktree, and per-session limits.

---

## Slice 013: Patch Readiness Gate

**Purpose:** Define the gate for future high-confidence autonomous patch application without enabling patch application yet.

**Files:**

- Create: `ask-core/src/core/OhderPatchReadinessGate.js`
- Test: `ask-core/tests/ohderPatchReadinessGate.contract.test.mjs`
- Docs: `docs/operations/future-ohder-runtime.md`

**Gate Inputs:**

- Refactor recommendation confidence.
- Blast radius.
- Matching tests.
- Rollback plan.
- Clean worktree.
- Approval policy.
- Semantic facts.

**Steps:**

1. Write failing tests showing low/medium confidence is not patch-ready.
2. Write failing tests showing missing tests or rollback plan blocks readiness.
3. Write tests showing high confidence plus low blast radius plus tests plus rollback returns `patchReady: true`.
4. Implement readiness gate only.
5. Do not wire automatic patch application.
6. Update future docs to clarify patch readiness vs patch execution.
7. Run targeted tests.
8. Close with `node ask-core/bin/ask.js slice close ohsmart-013`.

**Acceptance Criteria:**

- ASK can say whether a patch would be safe to consider.
- ASK still does not apply patches automatically.
- Future autonomy boundary remains explicit.

---

## Slice 014: Council-Lite Architecture Review Envelope

**Purpose:** Add a deterministic multi-perspective review envelope before full architectural councils exist.

**Files:**

- Create: `ask-core/src/core/OhderArchitectureReviewEnvelope.js`
- Modify: `ask-core/src/core/ArchitectRuntime.js`
- Test: `ask-core/tests/ohderArchitectureReviewEnvelope.contract.test.mjs`
- Docs: `docs/operations/future-ohder-runtime.md`

**Perspectives:**

- Survivability
- Replayability
- Security
- Durability
- Replaceability

**Steps:**

1. Write failing tests for deterministic review envelope output.
2. Add perspective summaries from semantic facts and architecture score.
3. Ensure no LLM/agent debate is introduced yet.
4. Add envelope to architect status.
5. Run architect and review tests.
6. Document this as council-lite, not full architectural councils.
7. Close with `node ask-core/bin/ask.js slice close ohsmart-014`.

**Acceptance Criteria:**

- Architect status has deterministic multi-perspective review evidence.
- Full architectural councils remain marked future.
- Review output is replayable.

---

## Slice 015: Semantic Autonomy Documentation And Release Notes

**Purpose:** Update operator docs, README, and release notes to explain the new semantic/autonomous OHDER maturity clearly.

**Files:**

- Modify: `README.md`
- Modify: `docs/operations/runtime-architecture.md`
- Modify: `docs/operations/policy-reference.md`
- Modify: `docs/operations/operator-playbooks.md`
- Modify: `docs/operations/ohder-analyzer-playbook.md`
- Modify: `docs/operations/future-ohder-runtime.md`
- Create: `docs/releases/v5.1.0.md`
- Test: `ask-core/tests/ohderSemanticAutonomyDocs.contract.test.mjs`

**Steps:**

1. Write failing docs contract for semantic facts, governance validate, mode profiles, and bounded autonomy docs.
2. Update README with the evolution from OHDER loop to semantic autonomy.
3. Update operations docs.
4. Add release note draft.
5. Run docs contract.
6. Run all OHDER tests.
7. Close with `node ask-core/bin/ask.js slice close ohsmart-015`.

**Acceptance Criteria:**

- Docs distinguish implemented semantic autonomy from future patch autonomy.
- Operators can see how to run governance validation and interpret semantic facts.
- Release note explains why this is a significant OHDER maturity release.

---

## Execution Order

Recommended ASK plan prefix: `ohsmart`.

Execution order:

1. `ohsmart-001` semantic fact envelope
2. `ohsmart-002` SSoT analyzer
3. `ohsmart-003` event-only sync analyzer
4. `ohsmart-004` duplication analyzer
5. `ohsmart-005` observability analyzer
6. `ohsmart-006` testability analyzer
7. `ohsmart-007` replaceability/YAGNI analyzer
8. `ohsmart-008` security semantic upgrade
9. `ohsmart-009` OHDER mode profiles
10. `ohsmart-010` mutating governance validation runtime
11. `ohsmart-011` ranked refactor target portfolio
12. `ohsmart-012` autonomous entropy reduction controller
13. `ohsmart-013` patch readiness gate
14. `ohsmart-014` council-lite architecture review envelope
15. `ohsmart-015` semantic autonomy docs and release note

Each slice must:

- Start with `node ask-core/bin/ask.js task start <taskId>`.
- Use TDD: failing contract first, then implementation.
- Run targeted tests before close.
- Close with `node ask-core/bin/ask.js slice close <taskId>`.
- Commit through ASK slice close with `ASK-Slice: <taskId>`.

