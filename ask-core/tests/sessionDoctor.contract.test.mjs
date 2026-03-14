import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { GuardedCommandRunner } from '../src/core/GuardedCommandRunner.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');
const TEST_TIMEOUT_MS = 600;

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

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-session-doctor-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  return repoDir;
}

test('session doctor reports missing operation state deterministically', () => {
  const repoDir = setupRepo();
  const result = run(process.execPath, [askBinPath, 'session', 'doctor'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.status, 'missing');
  assert.match(payload.suggestedRecovery, /run.*adapter|rerun/i);
});

test('session doctor reports failed state with recovery hint', () => {
  const repoDir = setupRepo();
  writeJson(path.join(repoDir, '.ask', 'runtime', 'last-operation.json'), {
    operation: 'pre-push-adapter:ask pre-push-check',
    status: 'failed',
    attempt: 2,
    maxAttempts: 2,
    startedAt: '2026-03-12T12:00:00.000Z',
    updatedAt: '2026-03-12T12:03:00.000Z',
    lastOutputAt: '2026-03-12T12:03:00.000Z',
    failureReason: 'no-output-timeout',
    command: {
      bin: process.execPath,
      args: [askBinPath, 'pre-push-check'],
    },
  });

  const result = run(process.execPath, [askBinPath, 'session', 'doctor'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.status, 'failed');
  assert.equal(payload.failureReason, 'no-output-timeout');
  assert.match(payload.suggestedRecovery, /rerun/i);
});

test('session doctor reports succeeded state after healthy run', async () => {
  const repoDir = setupRepo();
  const runner = new GuardedCommandRunner(repoDir, {
    wallTimeoutMs: TEST_TIMEOUT_MS,
    noOutputTimeoutMs: TEST_TIMEOUT_MS,
    maxRetriesOnStall: 1,
  });
  await runner.run({
    operation: 'contract:doctor-succeeded',
    command: process.execPath,
    args: ['-e', 'console.log("ok")'],
  });

  const result = run(process.execPath, [askBinPath, 'session', 'doctor'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'succeeded');
  assert.equal(payload.failureReason, '');
  assert.equal(payload.suggestedRecovery, 'none');
});

test('session doctor includes codex context summary when present', () => {
  const repoDir = setupRepo();
  writeJson(path.join(repoDir, '.ask', 'runtime', 'last-operation.json'), {
    operation: 'pre-commit-adapter:ask pre-commit-check',
    status: 'succeeded',
    attempt: 1,
    maxAttempts: 2,
    startedAt: '2026-03-12T12:00:00.000Z',
    updatedAt: '2026-03-12T12:02:00.000Z',
    lastOutputAt: '2026-03-12T12:01:00.000Z',
    failureReason: '',
    command: {
      bin: process.execPath,
      args: [askBinPath, 'pre-commit-check'],
    },
  });
  writeJson(path.join(repoDir, '.ask', 'runtime', 'context-session.json'), {
    enabled: true,
    status: 'below-threshold',
    remainingRatio: 0.08,
    suggestedAction: 'compact-now',
  });

  const result = run(process.execPath, [askBinPath, 'session', 'doctor'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'succeeded');
  assert.equal(payload.codexContext.enabled, true);
  assert.equal(payload.codexContext.status, 'below-threshold');
  assert.equal(payload.codexContext.remainingRatio, 0.08);
  assert.equal(payload.codexContext.suggestedAction, 'compact-now');
});
