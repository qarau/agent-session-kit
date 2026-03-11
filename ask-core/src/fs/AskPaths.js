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
}
