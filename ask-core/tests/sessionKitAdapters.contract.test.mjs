import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runPreCommitAdapter } from '../src/adapters/sessionKit/runPreCommitAdapter.js';
import { runPrePushAdapter } from '../src/adapters/sessionKit/runPrePushAdapter.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

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

function setupRepo(branchName = 'main') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-session-adapter-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', branchName], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  writeJson(path.join(tempRoot, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: branchName,
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    strictTasksDoc: false,
    governanceMode: 'project',
  });
  return tempRoot;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('pre-commit adapter no longer auto-starts session or forges test/docs evidence', async () => {
  const repoDir = setupRepo('main');

  await assert.rejects(
    () => runPreCommitAdapter(repoDir),
    /pre-commit-adapter:ask pre-commit-check/i
  );

  const session = readJson(path.join(repoDir, '.ask', 'sessions', 'active-session.json'));
  const evidence = readJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'));

  assert.equal(session.status, 'idle');
  assert.equal(evidence.testsPassed, false);
  assert.equal(evidence.docsFresh, false);
  assert.deepEqual(evidence.checks, []);
});

test('pre-push adapter no longer auto-starts session or forges test/docs evidence', async () => {
  const repoDir = setupRepo('main');

  await assert.rejects(
    () => runPrePushAdapter(repoDir),
    /pre-push-adapter:ask pre-push-check/i
  );

  const session = readJson(path.join(repoDir, '.ask', 'sessions', 'active-session.json'));
  const evidence = readJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'));

  assert.equal(session.status, 'idle');
  assert.equal(evidence.testsPassed, false);
  assert.equal(evidence.docsFresh, false);
  assert.deepEqual(evidence.checks, []);
});
