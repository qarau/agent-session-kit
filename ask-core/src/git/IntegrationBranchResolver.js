import { spawnSync } from 'node:child_process';

function normalize(value) {
  return String(value ?? '').trim();
}

function runGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
  return {
    status: Number(result.status ?? 1),
    stdout: String(result.stdout ?? '').trim(),
    stderr: String(result.stderr ?? '').trim(),
  };
}

export class IntegrationBranchResolver {
  constructor(cwd) {
    this.cwd = cwd;
  }

  currentBranch() {
    const result = runGit(this.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (result.status === 0 && result.stdout) {
      return result.stdout;
    }
    return 'unknown';
  }

  resolve(options = {}) {
    const headBranch = normalize(options.headBranch) || this.currentBranch();
    const baseBranch = normalize(options.baseBranch) || 'main';
    return {
      baseBranch,
      headBranch,
    };
  }
}
