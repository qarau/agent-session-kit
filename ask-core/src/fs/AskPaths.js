import path from 'node:path';

export class AskPaths {
  constructor(cwd) {
    this.cwd = cwd;
    this.root = path.join(cwd, '.ask');
  }

  policyDir() {
    return path.join(this.root, 'policy');
  }

  sessionsDir() {
    return path.join(this.root, 'sessions');
  }

  continuityDir() {
    return path.join(this.root, 'continuity');
  }

  evidenceDir() {
    return path.join(this.root, 'evidence');
  }

  handoffsDir() {
    return path.join(this.root, 'handoffs');
  }

  stateDir() {
    return path.join(this.root, 'state');
  }

  runtimeDir() {
    return path.join(this.root, 'runtime');
  }

  runtimeSnapshotsDir() {
    return path.join(this.runtimeDir(), 'snapshots');
  }

  tasksDir() {
    return path.join(this.root, 'tasks');
  }

  flowsDir() {
    return path.join(this.root, 'flows');
  }

  designDir() {
    return path.join(this.root, 'design');
  }

  worktreesDir() {
    return path.join(this.root, 'worktrees');
  }

  runtimePolicy() {
    return path.join(this.policyDir(), 'runtime-policy.yaml');
  }

  ohderLawPack() {
    return path.join(this.policyDir(), 'ohder-law-pack.json');
  }

  activeSession() {
    return path.join(this.sessionsDir(), 'active-session.json');
  }

  historyLog() {
    return path.join(this.sessionsDir(), 'history.ndjson');
  }

  pendingTransition() {
    return path.join(this.sessionsDir(), 'pending-transition.json');
  }

  currentStatus() {
    return path.join(this.continuityDir(), 'current-status.md');
  }

  openLoops() {
    return path.join(this.continuityDir(), 'open-loops.md');
  }

  nextActions() {
    return path.join(this.continuityDir(), 'next-actions.md');
  }

  resumePacket() {
    return path.join(this.continuityDir(), 'resume.json');
  }

  latestChecks() {
    return path.join(this.evidenceDir(), 'latest-checks.json');
  }

  latestHandoff() {
    return path.join(this.handoffsDir(), 'latest-handoff.md');
  }

  workContext() {
    return path.join(this.stateDir(), 'work-context.json');
  }

  lastOperation() {
    return path.join(this.runtimeDir(), 'last-operation.json');
  }

  contextSession() {
    return path.join(this.runtimeDir(), 'context-session.json');
  }

  runtimeEvents() {
    return path.join(this.runtimeDir(), 'events.ndjson');
  }

  sequenceState() {
    return path.join(this.runtimeDir(), 'sequence.json');
  }

  projectionState() {
    return path.join(this.runtimeDir(), 'projection-state.json');
  }

  runtimeMetrics() {
    return path.join(this.runtimeDir(), 'metrics.json');
  }

  runtimeMetricsHistory() {
    return path.join(this.runtimeDir(), 'metrics-history.ndjson');
  }

  runtimeDriftAnalytics() {
    return path.join(this.runtimeDir(), 'drift-analytics.json');
  }

  architectStatus() {
    return path.join(this.runtimeDir(), 'architect-status.json');
  }

  flowStatus() {
    return path.join(this.runtimeDir(), 'flow-status.json');
  }

  designStatus() {
    return path.join(this.runtimeDir(), 'design-status.json');
  }

  loopState() {
    return path.join(this.runtimeDir(), 'loop-state.json');
  }

  governanceDecision() {
    return path.join(this.runtimeDir(), 'governance-decision.json');
  }

  replayProof() {
    return path.join(this.runtimeDir(), 'replay-proof.json');
  }

  sequenceRepairReport() {
    return path.join(this.runtimeDir(), 'sequence-repair-report.json');
  }

  sessionSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'session.json');
  }

  taskBoardSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'tasks.json');
  }

  verificationSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'verification.json');
  }

  workflowSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'workflow.json');
  }

  freshnessSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'freshness.json');
  }

  integrationSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'integration.json');
  }

  mergeReadinessSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'merge-readiness.json');
  }

  claimsSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'claims.json');
  }

  routingSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'routing.json');
  }

  childSessionsSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'child-sessions.json');
  }

  agentsSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'agents.json');
  }

  queueClassesSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'queue-classes.json');
  }

  policyPacksSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'policy-packs.json');
  }

  featuresSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'features.json');
  }

  releaseTrainsSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'release-trains.json');
  }

  promotionGatesSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'promotion-gates.json');
  }

  rolloutSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'rollout.json');
  }

  subagentDispatchSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'subagent-dispatch.json');
  }

  subagentDispatchControlSnapshot() {
    return path.join(this.runtimeSnapshotsDir(), 'subagent-dispatch-control.json');
  }

  taskRegistry() {
    return path.join(this.tasksDir(), 'task-board.json');
  }

  productFlowDoc() {
    return path.join(this.flowsDir(), 'product-flow.md');
  }

  productFlowContract() {
    return path.join(this.flowsDir(), 'product-flow.json');
  }

  flowHistory() {
    return path.join(this.flowsDir(), 'flow-history.ndjson');
  }

  flowMap() {
    return path.join(this.flowsDir(), 'flow-map.json');
  }

  flowMetrics() {
    return path.join(this.flowsDir(), 'flow-metrics.json');
  }

  designSystemDoc() {
    return path.join(this.designDir(), 'design-system.md');
  }

  designTokens() {
    return path.join(this.designDir(), 'design-tokens.json');
  }

  componentPatterns() {
    return path.join(this.designDir(), 'component-patterns.json');
  }

  modalContracts() {
    return path.join(this.designDir(), 'modal-contracts.json');
  }

  visualRegressionMap() {
    return path.join(this.designDir(), 'visual-regression-map.json');
  }

  designHistory() {
    return path.join(this.designDir(), 'design-history.ndjson');
  }

  designMetrics() {
    return path.join(this.designDir(), 'design-metrics.json');
  }
}
