# ASK 3.0 Runtime Evolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Evolve ASK 2.0 into ASK 3.0 as a Session OS by adding an event-ledger core, task/workflow runtime, freshness/integration orchestration, agent coordination, policy lanes, and delivery governance.

**Architecture:** Use a bridge migration that keeps current ASK 2.0 contracts live while introducing event-first writes and replay-derived snapshots. Build in slices: Event Ledger foundation first, then task/workflow/freshness execution layers, then multi-agent routing and delivery layers. Keep ASK core platform-agnostic; adapters remain thin integration clients. Superpowers integration in this plan refers to the external repo `https://github.com/obra/superpowers`.

**Tech Stack:** Node.js 20+ ESM, ask-core CLI, git/hooks, NDJSON event log, JSON snapshots/projectors, Node test runner (`node --test`), existing ASK adapters and docs.

---

Execution discipline for every task:
- Use `@superpowers:test-driven-development` (red -> green -> refactor).
- Use `@superpowers:verification-before-completion` before each completion claim.
- Keep bridge compatibility until phase cutover says otherwise.
- Keep commits small and phase-scoped.

## Milestone Structure

1. Event Ledger foundation (v0.1)
2. Task + evidence + verify runtime (v0.2)
3. Superpowers (`obra/superpowers`) workflow adapter integration (v0.3)
4. Dependency freshness + integration orchestration (v0.4)
5. Agent routing + child task sessions (v0.5)
6. Queue classes + policy packs (v0.6)
7. Release trains + promotion + rollout (v0.7)

## Enterprise Superpowers Integration Baseline

- Treat `obra/superpowers` as an external provider; ASK only consumes adapter contracts.
- Pin provider versions per environment (`dev`, `candidate`, `staging`, `prod`) and disallow floating refs.
- Mirror and promote artifacts through enterprise supply-chain controls (SBOM, signing/provenance, vulnerability scan).
- Enforce an ASK-side skill allowlist and queue-class-to-skill mapping.
- Add a compatibility harness that validates ASK adapter contracts for each provider version before promotion.
- Add runtime kill switch and deterministic fallback path (ASK governance continues if provider is unavailable).
- Emit audit-grade workflow events for recommendation, run start/complete/fail, and artifact registration.

---

### Task 1: Event Ledger Foundation (Paths, Store, Sequence, Ledger)

**Files:**
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/fs/FileStore.js`
- Create: `ask-core/src/runtime/SequenceStore.js`
- Create: `ask-core/src/runtime/EventLedger.js`
- Modify: `ask-core/src/fs/Scaffolder.js`
- Test: `ask-core/tests/eventLedger.foundation.contract.test.mjs`

**Step 1: Write failing tests**

Add tests for:
- sequence increments deterministically
- event append writes NDJSON envelope with `seq`, `type`, `ts`
- `ask init` scaffolds runtime ledger files (`events.ndjson`, `sequence.json`)

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/eventLedger.foundation.contract.test.mjs`  
Expected: FAIL with missing paths/modules/methods.

**Step 3: Write minimal implementation**

```js
// ask-core/src/runtime/SequenceStore.js
export class SequenceStore {
  async next() { /* read sequence.json, increment, persist */ }
}
```

```js
// ask-core/src/runtime/EventLedger.js
export class EventLedger {
  async append({ type, sessionId, taskId, actor = 'local', payload = {}, meta = {} }) {
    // next seq -> append JSON line
  }
}
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/eventLedger.foundation.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/fs/AskPaths.js ask-core/src/fs/FileStore.js ask-core/src/runtime/SequenceStore.js ask-core/src/runtime/EventLedger.js ask-core/src/fs/Scaffolder.js ask-core/tests/eventLedger.foundation.contract.test.mjs
git commit -m "feat: add event ledger foundation and runtime scaffolding"
```

---

### Task 2: Replay Engine + Core Projectors

**Files:**
- Create: `ask-core/src/runtime/RuntimeSnapshotStore.js`
- Create: `ask-core/src/runtime/RuntimeProjectionEngine.js`
- Create: `ask-core/src/runtime/projectors/SessionProjector.js`
- Create: `ask-core/src/runtime/projectors/TaskBoardProjector.js`
- Create: `ask-core/src/runtime/projectors/VerificationProjector.js`
- Create: `ask-core/src/cli/commands/replay.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/replayProjection.contract.test.mjs`

**Step 1: Write failing tests**

Add tests for:
- replay consumes events sorted by `seq`
- snapshots written to runtime snapshot paths
- `ask replay` prints concise summary + exits 0

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/replayProjection.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
// RuntimeProjectionEngine replay shape
const events = await this.ledger.readAll();
let session = this.sessionProjector.initialState();
let tasks = this.taskBoardProjector.initialState();
let verification = this.verificationProjector.initialState();
for (const event of events) { /* apply */ }
await this.snapshots.writeSession(session);
await this.snapshots.writeTasks(tasks);
await this.snapshots.writeVerification(verification);
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/replayProjection.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/runtime/RuntimeSnapshotStore.js ask-core/src/runtime/RuntimeProjectionEngine.js ask-core/src/runtime/projectors/SessionProjector.js ask-core/src/runtime/projectors/TaskBoardProjector.js ask-core/src/runtime/projectors/VerificationProjector.js ask-core/src/cli/commands/replay.js ask-core/src/cli/index.js ask-core/tests/replayProjection.contract.test.mjs
git commit -m "feat: add replay engine and core runtime projectors"
```

---

### Task 3: Session Runtime Bridge to Event-First Writes

**Files:**
- Modify: `ask-core/src/core/SessionRuntime.js`
- Modify: `ask-core/src/core/HandoffEngine.js`
- Modify: `ask-core/src/core/WorkContextEngine.js`
- Test: `ask-core/tests/sessionEventBridge.contract.test.mjs`

**Step 1: Write failing tests**

Add tests for:
- `session start/resume/close` append session events then replay
- handoff emits `SessionHandoffGenerated`
- context verify emits `WorktreeVerified`
- backward snapshots (`active-session.json`, `work-context.json`) remain present

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/sessionEventBridge.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
// SessionRuntime transition flow
await this.ledger.append({ type: 'SessionStarted', ... });
await this.projectionEngine.replay();
return this.snapshots.readSession();
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/sessionEventBridge.contract.test.mjs ask-core/tests/sessionLifecycle.contract.test.mjs ask-core/tests/sessionRecovery.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/core/SessionRuntime.js ask-core/src/core/HandoffEngine.js ask-core/src/core/WorkContextEngine.js ask-core/tests/sessionEventBridge.contract.test.mjs
git commit -m "feat: bridge session, handoff, and context flows to event-first replay"
```

---

### Task 4: Task Runtime + Task CLI

**Files:**
- Create: `ask-core/src/core/TaskRuntime.js`
- Create: `ask-core/src/cli/commands/task.js`
- Create: `ask-core/src/runtime/invariants/taskInvariants.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/taskRuntime.contract.test.mjs`

**Step 1: Write failing tests**

Add contracts for:
- `ask task create <id> --title "..."`
- `ask task assign <id> --owner ...`
- `ask task start <id>`
- `ask task status [id]`
- invalid state transitions reject before event append

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/taskRuntime.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
// TaskRuntime skeleton
await this.ledger.append({ type: 'TaskCreated', sessionId, taskId, payload: { title, description } });
await this.projections.replay();
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/taskRuntime.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/core/TaskRuntime.js ask-core/src/cli/commands/task.js ask-core/src/runtime/invariants/taskInvariants.js ask-core/src/cli/index.js ask-core/tests/taskRuntime.contract.test.mjs
git commit -m "feat: add event-driven task runtime and CLI"
```

---

### Task 5: Evidence + Verify Runtime Commands

**Files:**
- Create: `ask-core/src/core/VerificationRuntime.js`
- Create: `ask-core/src/cli/commands/evidence.js`
- Create: `ask-core/src/cli/commands/verify.js`
- Modify: `ask-core/src/core/EvidenceRecorder.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/evidenceVerify.contract.test.mjs`

**Step 1: Write failing tests**

Contracts:
- `ask evidence attach <taskId> ...` appends `EvidenceAttached`
- `ask verify pass|fail <taskId> ...` appends verification events
- verification projection updates task verification status

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/evidenceVerify.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
await this.ledger.append({ type: 'EvidenceAttached', sessionId, taskId, payload: { kind, path, summary } });
await this.projections.replay();
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/evidenceVerify.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/core/VerificationRuntime.js ask-core/src/cli/commands/evidence.js ask-core/src/cli/commands/verify.js ask-core/src/core/EvidenceRecorder.js ask-core/src/cli/index.js ask-core/tests/evidenceVerify.contract.test.mjs
git commit -m "feat: add event-driven evidence and verification commands"
```

---

### Task 6: Superpowers (`obra/superpowers`) Workflow Adapter v0.1

**Files:**
- Create: `ask-core/src/adapters/WorkflowAdapter.js`
- Create: `ask-core/src/adapters/WorkflowRegistry.js`
- Create: `ask-core/src/adapters/SuperpowersAdapter.js`
- Create: `ask-core/src/core/WorkflowRuntime.js`
- Create: `ask-core/src/runtime/projectors/WorkflowProjector.js`
- Create: `ask-core/src/cli/commands/workflow.js`
- Modify: `ask-core/src/runtime/RuntimeProjectionEngine.js`
- Modify: `ask-core/src/runtime/RuntimeSnapshotStore.js`
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/workflowAdapter.contract.test.mjs`

**Step 1: Write failing tests**

Contracts:
- `ask workflow recommend <taskId>`
- `ask workflow start|artifact|complete|fail`
- workflow snapshot derived from events
- assert adapter outputs canonical Superpowers skill IDs without depending on Superpowers internal source layout

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/workflowAdapter.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
// SuperpowersAdapter recommendation core
if (task.status === 'created' && !hasPlanArtifact) return { workflow: 'superpowers', skill: 'writing-plans' };
if (task.status === 'completed' && latestVerification !== 'passed') return { workflow: 'superpowers', skill: 'verification-before-completion' };
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/workflowAdapter.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/adapters/WorkflowAdapter.js ask-core/src/adapters/WorkflowRegistry.js ask-core/src/adapters/SuperpowersAdapter.js ask-core/src/core/WorkflowRuntime.js ask-core/src/runtime/projectors/WorkflowProjector.js ask-core/src/cli/commands/workflow.js ask-core/src/runtime/RuntimeProjectionEngine.js ask-core/src/runtime/RuntimeSnapshotStore.js ask-core/src/fs/AskPaths.js ask-core/src/cli/index.js ask-core/tests/workflowAdapter.contract.test.mjs
git commit -m "feat: add superpowers workflow adapter and workflow runtime"
```

---

### Task 6A: Enterprise Guardrails for `obra/superpowers` Integration

**Files:**
- Create: `ask-core/src/adapters/superpowers/SuperpowersVersionPolicy.js`
- Create: `ask-core/src/adapters/superpowers/SuperpowersSkillAllowlist.js`
- Create: `ask-core/src/adapters/superpowers/SuperpowersCompatibilityHarness.js`
- Modify: `ask-core/src/adapters/WorkflowRegistry.js`
- Modify: `ask-core/src/adapters/SuperpowersAdapter.js`
- Modify: `ask-core/src/policy/defaultPolicy.js`
- Create: `ask-core/src/cli/commands/workflow-provider.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/superpowersEnterprise.contract.test.mjs`

**Step 1: Write failing tests**

Contracts:
- provider version resolution rejects unpinned/unknown versions
- only allowlisted skills are accepted by adapter runtime
- compatibility harness reports pass/fail by provider version
- adapter kill switch forces deterministic fallback behavior

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/superpowersEnterprise.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
if (!isVersionAllowed(providerVersion)) throw new Error('workflow provider version is not approved');
if (!isSkillAllowed(skillId)) throw new Error('skill not allowed by enterprise policy');
if (workflowProviderDisabled) return fallbackRecommendation;
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/superpowersEnterprise.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/adapters/superpowers/SuperpowersVersionPolicy.js ask-core/src/adapters/superpowers/SuperpowersSkillAllowlist.js ask-core/src/adapters/superpowers/SuperpowersCompatibilityHarness.js ask-core/src/adapters/WorkflowRegistry.js ask-core/src/adapters/SuperpowersAdapter.js ask-core/src/policy/defaultPolicy.js ask-core/src/cli/commands/workflow-provider.js ask-core/src/cli/index.js ask-core/tests/superpowersEnterprise.contract.test.mjs
git commit -m "feat: add enterprise guardrails for superpowers provider integration"
```

---

### Task 7: Dependency-Aware Freshness

**Files:**
- Create: `ask-core/src/runtime/DependencyGraph.js`
- Create: `ask-core/src/runtime/projectors/FreshnessProjector.js`
- Create: `ask-core/src/core/FreshnessRuntime.js`
- Create: `ask-core/src/cli/commands/freshness.js`
- Modify: `ask-core/src/cli/commands/task.js` (add `task depends`)
- Modify: `ask-core/src/runtime/RuntimeProjectionEngine.js`
- Modify: `ask-core/src/runtime/RuntimeSnapshotStore.js`
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/adapters/SuperpowersAdapter.js`
- Test: `ask-core/tests/freshness.contract.test.mjs`

**Step 1: Write failing tests**

Contracts:
- `task depends A B` records dependency
- verification becomes stale when dependency changes after pass
- `ask freshness status|explain` returns deterministic explanation

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/freshness.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
if (verificationPassedAt && latestDependencyChangeAt > verificationPassedAt) {
  status = 'stale';
}
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/freshness.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/runtime/DependencyGraph.js ask-core/src/runtime/projectors/FreshnessProjector.js ask-core/src/core/FreshnessRuntime.js ask-core/src/cli/commands/freshness.js ask-core/src/cli/commands/task.js ask-core/src/runtime/RuntimeProjectionEngine.js ask-core/src/runtime/RuntimeSnapshotStore.js ask-core/src/fs/AskPaths.js ask-core/src/adapters/SuperpowersAdapter.js ask-core/tests/freshness.contract.test.mjs
git commit -m "feat: add dependency-aware freshness runtime and CLI"
```

---

### Task 8: Integration Workspace + Auto Integration + Merge Readiness

**Files:**
- Create: `ask-core/src/core/IntegrationRuntime.js`
- Create: `ask-core/src/core/AutoIntegrationRuntime.js`
- Create: `ask-core/src/git/IntegrationBranchResolver.js`
- Create: `ask-core/src/git/IntegrationMergePlanner.js`
- Create: `ask-core/src/git/IntegrationOrchestrator.js`
- Create: `ask-core/src/git/IntegrationTempWorktreeManager.js`
- Create: `ask-core/src/runtime/projectors/IntegrationProjector.js`
- Create: `ask-core/src/runtime/projectors/MergeReadinessProjector.js`
- Create: `ask-core/src/cli/commands/integration.js`
- Create: `ask-core/src/cli/commands/integration-auto.js`
- Modify: `ask-core/src/runtime/RuntimeProjectionEngine.js`
- Modify: `ask-core/src/runtime/RuntimeSnapshotStore.js`
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/integrationRuntime.contract.test.mjs`

**Step 1: Write failing tests**

Contracts:
- integration plan/run/status emit expected events
- auto integration emits pass/fail + evidence attached
- merge readiness revokes when integration missing/failed

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/integrationRuntime.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
// Integration run core
await ledger.append({ type: 'IntegrationRunStarted', ... });
// run command in temp workspace
await ledger.append({ type: passed ? 'IntegrationRunPassed' : 'IntegrationRunFailed', ... });
await projectionEngine.replay();
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/integrationRuntime.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/core/IntegrationRuntime.js ask-core/src/core/AutoIntegrationRuntime.js ask-core/src/git/IntegrationBranchResolver.js ask-core/src/git/IntegrationMergePlanner.js ask-core/src/git/IntegrationOrchestrator.js ask-core/src/git/IntegrationTempWorktreeManager.js ask-core/src/runtime/projectors/IntegrationProjector.js ask-core/src/runtime/projectors/MergeReadinessProjector.js ask-core/src/cli/commands/integration.js ask-core/src/cli/commands/integration-auto.js ask-core/src/runtime/RuntimeProjectionEngine.js ask-core/src/runtime/RuntimeSnapshotStore.js ask-core/src/fs/AskPaths.js ask-core/src/cli/index.js ask-core/tests/integrationRuntime.contract.test.mjs
git commit -m "feat: add integration orchestration and merge-readiness projections"
```

---

### Task 9: Agent Routing + Claims + Child Task Sessions

**Files:**
- Create: `ask-core/src/core/RoutingRuntime.js`
- Create: `ask-core/src/core/ClaimRuntime.js`
- Create: `ask-core/src/core/ChildSessionRuntime.js`
- Create: `ask-core/src/core/AgentRuntime.js`
- Create: `ask-core/src/policy/AgentCapabilityRegistry.js`
- Create: `ask-core/src/policy/RoutingPolicyEngine.js`
- Create: `ask-core/src/runtime/projectors/ClaimProjector.js`
- Create: `ask-core/src/runtime/projectors/RoutingProjector.js`
- Create: `ask-core/src/runtime/projectors/ChildSessionProjector.js`
- Create: `ask-core/src/runtime/projectors/AgentProjector.js`
- Create: `ask-core/src/cli/commands/route.js`
- Create: `ask-core/src/cli/commands/claim.js`
- Create: `ask-core/src/cli/commands/child-session.js`
- Create: `ask-core/src/cli/commands/agent.js`
- Modify: `ask-core/src/runtime/RuntimeProjectionEngine.js`
- Modify: `ask-core/src/runtime/RuntimeSnapshotStore.js`
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/agentCoordination.contract.test.mjs`

**Step 1: Write failing tests**

Contracts:
- route recommend based on capability/policy
- claim acquire/release/lock scope
- task spawn creates child session and agent linkage

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/agentCoordination.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
await ledger.append({ type: 'TaskClaimAcquired', taskId, payload: { agentId } });
await ledger.append({ type: 'ChildSessionCreated', taskId, payload: { childSessionId } });
await projectionEngine.replay();
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/agentCoordination.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/core/RoutingRuntime.js ask-core/src/core/ClaimRuntime.js ask-core/src/core/ChildSessionRuntime.js ask-core/src/core/AgentRuntime.js ask-core/src/policy/AgentCapabilityRegistry.js ask-core/src/policy/RoutingPolicyEngine.js ask-core/src/runtime/projectors/ClaimProjector.js ask-core/src/runtime/projectors/RoutingProjector.js ask-core/src/runtime/projectors/ChildSessionProjector.js ask-core/src/runtime/projectors/AgentProjector.js ask-core/src/cli/commands/route.js ask-core/src/cli/commands/claim.js ask-core/src/cli/commands/child-session.js ask-core/src/cli/commands/agent.js ask-core/src/runtime/RuntimeProjectionEngine.js ask-core/src/runtime/RuntimeSnapshotStore.js ask-core/src/fs/AskPaths.js ask-core/src/cli/index.js ask-core/tests/agentCoordination.contract.test.mjs
git commit -m "feat: add agent routing, claims, and child session runtime"
```

---

### Task 10: Queue Classes + Policy Packs

**Files:**
- Create: `ask-core/src/policy/QueueClassRegistry.js`
- Create: `ask-core/src/policy/ExecutionPolicyPackRegistry.js`
- Create: `ask-core/src/core/TaskClassifier.js`
- Create: `ask-core/src/core/ExecutionPolicyRuntime.js`
- Create: `ask-core/src/runtime/projectors/QueueClassProjector.js`
- Create: `ask-core/src/runtime/projectors/PolicyPackProjector.js`
- Create: `ask-core/src/cli/commands/policy.js`
- Modify: `ask-core/src/runtime/RuntimeProjectionEngine.js`
- Modify: `ask-core/src/runtime/RuntimeSnapshotStore.js`
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/cli/index.js`
- Modify: `ask-core/src/adapters/SuperpowersAdapter.js`
- Test: `ask-core/tests/policyPacks.contract.test.mjs`

**Step 1: Write failing tests**

Contracts:
- classify task into `planner|implementer|verifier|debugger|integrator|reviewer`
- policy apply emits hold/dispatch decisions
- policy snapshots written deterministically

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/policyPacks.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
if (task.status === 'completed' && verification !== 'passed') return 'verifier';
if (latestVerification === 'failed') return 'debugger';
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/policyPacks.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/policy/QueueClassRegistry.js ask-core/src/policy/ExecutionPolicyPackRegistry.js ask-core/src/core/TaskClassifier.js ask-core/src/core/ExecutionPolicyRuntime.js ask-core/src/runtime/projectors/QueueClassProjector.js ask-core/src/runtime/projectors/PolicyPackProjector.js ask-core/src/cli/commands/policy.js ask-core/src/runtime/RuntimeProjectionEngine.js ask-core/src/runtime/RuntimeSnapshotStore.js ask-core/src/fs/AskPaths.js ask-core/src/cli/index.js ask-core/src/adapters/SuperpowersAdapter.js ask-core/tests/policyPacks.contract.test.mjs
git commit -m "feat: add queue classes and execution policy packs"
```

---

### Task 11: Release Trains + Promotion Gates + Rollout Policies

**Files:**
- Create: `ask-core/src/core/FeatureRuntime.js`
- Create: `ask-core/src/core/ReleaseTrainRuntime.js`
- Create: `ask-core/src/core/PromotionRuntime.js`
- Create: `ask-core/src/core/RolloutRuntime.js`
- Create: `ask-core/src/runtime/projectors/FeatureProjector.js`
- Create: `ask-core/src/runtime/projectors/ReleaseTrainProjector.js`
- Create: `ask-core/src/runtime/projectors/PromotionGateProjector.js`
- Create: `ask-core/src/runtime/projectors/RolloutProjector.js`
- Create: `ask-core/src/cli/commands/feature.js`
- Create: `ask-core/src/cli/commands/release.js`
- Create: `ask-core/src/cli/commands/promote.js`
- Create: `ask-core/src/cli/commands/rollout.js`
- Create: `ask-core/src/cli/commands/rollback.js`
- Modify: `ask-core/src/runtime/RuntimeProjectionEngine.js`
- Modify: `ask-core/src/runtime/RuntimeSnapshotStore.js`
- Modify: `ask-core/src/fs/AskPaths.js`
- Modify: `ask-core/src/cli/index.js`
- Test: `ask-core/tests/deliveryGovernance.contract.test.mjs`

**Step 1: Write failing tests**

Contracts:
- feature create/link-task status
- release create/link-feature status
- promote require/pass/advance invariants
- rollout start/phase/status and rollback trigger/status

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test ask-core/tests/deliveryGovernance.contract.test.mjs`  
Expected: FAIL.

**Step 3: Write minimal implementation**

```js
if (!trainCandidateReady) throw new Error('cannot advance to candidate');
await ledger.append({ type: 'PromotionGatePassed', ... });
```

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test ask-core/tests/deliveryGovernance.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add ask-core/src/core/FeatureRuntime.js ask-core/src/core/ReleaseTrainRuntime.js ask-core/src/core/PromotionRuntime.js ask-core/src/core/RolloutRuntime.js ask-core/src/runtime/projectors/FeatureProjector.js ask-core/src/runtime/projectors/ReleaseTrainProjector.js ask-core/src/runtime/projectors/PromotionGateProjector.js ask-core/src/runtime/projectors/RolloutProjector.js ask-core/src/cli/commands/feature.js ask-core/src/cli/commands/release.js ask-core/src/cli/commands/promote.js ask-core/src/cli/commands/rollout.js ask-core/src/cli/commands/rollback.js ask-core/src/runtime/RuntimeProjectionEngine.js ask-core/src/runtime/RuntimeSnapshotStore.js ask-core/src/fs/AskPaths.js ask-core/src/cli/index.js ask-core/tests/deliveryGovernance.contract.test.mjs
git commit -m "feat: add release trains, promotion gates, and rollout runtime"
```

---

### Task 12: Documentation, Installer Surface, and Release Gating

**Files:**
- Modify: `README.md`
- Modify: `docs/how-it-works.md`
- Modify: `docs/adoption-guide.md`
- Modify: `docs/maintainer-mode.md`
- Create: `docs/ask-3.0-architecture.md`
- Modify: `install-session-kit.mjs` (install new ASK 3.0 runtime components)
- Modify: `tests/sessionKitSmoke.test.mjs`
- Test: `tests/ask3RuntimeDocs.contract.test.mjs`
- Modify: `docs/releases/latest.md` (when publishing)

**Step 1: Write failing docs/installer tests**

Add assertions that:
- CLI help includes new command families
- installer scaffolds required ASK 3.0 runtime directories/snapshots
- docs no longer describe ASK as only commit/push gate runtime

**Step 2: Run tests to verify RED**

Run: `cmd /c node --test tests/sessionKitSmoke.test.mjs tests/ask3RuntimeDocs.contract.test.mjs`  
Expected: FAIL.

**Step 3: Implement docs + installer updates**

Keep migration guidance explicit:
- bridge mode (event + legacy files)
- cutover mode (projection snapshots authoritative)

**Step 4: Run tests to verify GREEN**

Run: `cmd /c node --test tests/sessionKitSmoke.test.mjs tests/ask3RuntimeDocs.contract.test.mjs`  
Expected: PASS.

**Step 5: Commit**

```bash
git add README.md docs/how-it-works.md docs/adoption-guide.md docs/maintainer-mode.md docs/ask-3.0-architecture.md install-session-kit.mjs tests/sessionKitSmoke.test.mjs tests/ask3RuntimeDocs.contract.test.mjs
git commit -m "docs: publish ask 3.0 runtime architecture and installer guidance"
```

---

### Task 13: Full Verification, Cutover Decision, and Session Evidence

**Files:**
- Modify: `docs/session/current-status.md`
- Modify: `docs/session/tasks.md`
- Modify: `docs/session/change-log.md`
- Modify: `docs/session/open-loops.md`

**Step 1: Run full verification matrix**

Run:

```bash
cmd /c npm run test
cmd /c node --test ask-core/tests/*.mjs
cmd /c node ask-core/bin/ask.js replay
cmd /c node ask-core/bin/ask.js session doctor
```

Expected: all pass; replay succeeds from empty + populated event logs.

**Step 2: Run smoke flows from RFC docs**

Run representative command sets from:
- Event Ledger v0.1
- Superpowers Adapter v0.1
- Release/Promotion/Rollout v0.1
- Superpowers enterprise compatibility harness by pinned provider version

Expected: deterministic snapshots and event traces.

**Step 3: Decide bridge vs cutover**

Decision criteria:
- If projection parity is stable for two release cycles, deprecate direct mutation reads.
- If parity gaps remain, keep bridge mode and log blockers.

**Step 4: Record evidence**

Append exact commands + outcomes into `docs/session/change-log.md`.

**Step 5: Final commit**

```bash
git add docs/session/current-status.md docs/session/tasks.md docs/session/change-log.md docs/session/open-loops.md
git commit -m "chore: record ask 3.0 verification evidence and cutover decision"
```

---

## Non-Goals for v0.1-v0.3

- Remote multi-writer event sync
- CRDT merge of event logs
- Rich dashboard UI
- Plugin marketplace
- Forking or modifying `obra/superpowers` internals inside ASK core
- Breaking existing ASK 2.0 pre-commit/pre-push guarantees during migration

---

## Exit Criteria (ASK 3.0 Ready)

- Event log can reconstruct runtime state (`ask replay`) without manual fixes.
- Session/task/workflow/evidence/freshness/integration states are projection-derived.
- Routing/claims/child sessions produce deterministic snapshots.
- Policy packs classify and gate dispatch decisions correctly.
- Release/promotion/rollout/rollback flow is invariant-enforced and test-covered.
- Superpowers provider integration is pinned, allowlisted, compatibility-verified, and kill-switch protected.
- Installer and docs support clean bootstrap for downstream repos.
