import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function normalize(value) {
  return String(value ?? '').trim();
}

function safeSegment(value) {
  return normalize(value).replace(/[^a-zA-Z0-9._-]/gu, '-').slice(0, 80) || 'default';
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

function gitOrThrow(cwd, args) {
  const result = runGit(cwd, args);
  if (result.status === 0) {
    return result;
  }
  throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`.trim());
}

export class IntegrationTempWorktreeManager {
  constructor(cwd) {
    this.cwd = cwd;
  }

  async provision(runId = '') {
    const resolvedRunId = safeSegment(runId);
    const repoRoot = this.cwd;
    const workspacePath = path.join(this.cwd, '.ask', 'runtime', 'integration-workspaces', resolvedRunId);
    await fs.rm(workspacePath, { recursive: true, force: true });
    await fs.mkdir(path.dirname(workspacePath), { recursive: true });

    const head = gitOrThrow(this.cwd, ['rev-parse', '--verify', 'HEAD']).stdout;
    gitOrThrow(this.cwd, ['worktree', 'add', '--detach', workspacePath, head]);

    return {
      path: workspacePath,
      mode: 'git-worktree',
      head,
      async cleanup() {
        const remove = runGit(repoRoot, ['worktree', 'remove', '--force', workspacePath]);
        if (remove.status === 0) {
          return;
        }
        try {
          await fs.rm(workspacePath, { recursive: true, force: true });
        } catch {
          // no-op cleanup fallback
        }
      },
    };
  }
}
