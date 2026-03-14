import { IntegrationBranchResolver } from './IntegrationBranchResolver.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function defaultRunId() {
  return `integration_${Date.now().toString(36)}`;
}

export class IntegrationMergePlanner {
  constructor(cwd, overrides = {}) {
    this.cwd = cwd;
    this.branchResolver = overrides.branchResolver ?? new IntegrationBranchResolver(cwd);
  }

  plan(options = {}) {
    const taskId = normalize(options.taskId);
    const runId = normalize(options.runId) || defaultRunId();
    const branches = this.branchResolver.resolve({
      baseBranch: options.baseBranch,
      headBranch: options.headBranch,
    });

    return {
      taskId,
      runId,
      baseBranch: branches.baseBranch,
      headBranch: branches.headBranch,
      strategy: 'merge',
      plannedAt: new Date().toISOString(),
    };
  }
}
