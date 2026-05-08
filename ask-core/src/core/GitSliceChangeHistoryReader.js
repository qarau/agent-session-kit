import { spawnSync } from 'node:child_process';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function unique(values = []) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function parseSliceIds(message = '') {
  const sliceIds = [];
  const pattern = /^ASK-Slice:\s*(.+)$/gimu;
  let match = pattern.exec(String(message ?? ''));
  while (match) {
    sliceIds.push(normalize(match[1]));
    match = pattern.exec(String(message ?? ''));
  }
  return unique(sliceIds).sort();
}

export class GitSliceChangeHistoryReader {
  constructor(cwd) {
    this.cwd = cwd;
  }

  runGit(args) {
    const result = spawnSync('git', args, {
      cwd: this.cwd,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      return '';
    }
    return String(result.stdout ?? '').trim();
  }

  read(maxCommits = 40) {
    const limit = Math.max(1, Math.floor(Number(maxCommits) || 40));
    const shas = this.runGit(['log', `--max-count=${String(limit)}`, '--format=%H'])
      .split(/\r?\n/u)
      .map(normalize)
      .filter(Boolean);
    const changeSets = [];
    for (const sha of shas) {
      const message = this.runGit(['show', '-s', '--format=%B', sha]);
      const sliceIds = parseSliceIds(message);
      if (sliceIds.length < 1) {
        continue;
      }
      const files = this.runGit(['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', sha])
        .split(/\r?\n/u)
        .map(normalizePath)
        .filter(Boolean)
        .filter(filePath => !filePath.startsWith('.ask/'));
      for (const taskId of sliceIds) {
        changeSets.push({
          taskId,
          sliceId: taskId,
          commit: sha,
          files,
        });
      }
    }
    return changeSets;
  }
}
