import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
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

function runOrThrow(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `status=${String(result.status)}`,
        result.stdout,
        result.stderr,
      ].join('\n')
    );
  }
  return result;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function setupTempRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-adapter-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  writeJson(path.join(repoDir, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: 'ask-runtime',
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    strictTasksDoc: false,
  });
  return repoDir;
}

test('pre-commit adapter wrapper exits 0 in healthy ask-runtime worktree', () => {
  const repoDir = setupTempRepo();
  const adapterWrapperPath = path.join(repoRoot, 'scripts', 'session', 'runAskCorePreCommitAdapter.mjs');

  const result = run(process.execPath, [adapterWrapperPath], {
    cwd: repoDir,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('pre-push adapter wrapper exits 0 in healthy ask-runtime worktree', () => {
  const result = run(process.execPath, ['scripts/session/runAskCorePrePushAdapter.mjs'], {
    cwd: repoRoot,
    env: {
      SESSION_CONTEXT_BYPASS: '1',
      SESSION_DOCS_BYPASS: '1',
    },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('pre-push adapter wrapper exits 0 in temp repo without legacy kit scripts', () => {
  const repoDir = setupTempRepo();
  const adapterWrapperPath = path.join(repoRoot, 'scripts', 'session', 'runAskCorePrePushAdapter.mjs');

  const result = run(process.execPath, [adapterWrapperPath], {
    cwd: repoDir,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
