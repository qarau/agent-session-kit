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

  worktreesDir() {
    return path.join(this.root, 'worktrees');
  }

  runtimePolicy() {
    return path.join(this.policyDir(), 'runtime-policy.yaml');
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

  taskRegistry() {
    return path.join(this.tasksDir(), 'task-board.json');
  }
}
