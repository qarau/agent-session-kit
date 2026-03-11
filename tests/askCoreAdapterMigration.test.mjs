import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

test('pre-commit adapter wrapper exits 0 in healthy ask-runtime worktree', () => {
  const result = run(process.execPath, ['scripts/session/runAskCorePreCommitAdapter.mjs'], {
    cwd: repoRoot,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('pre-push adapter wrapper exits 0 in healthy ask-runtime worktree', () => {
  const result = run(process.execPath, ['scripts/session/runAskCorePrePushAdapter.mjs'], {
    cwd: repoRoot,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
