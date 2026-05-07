import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

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

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-next-action-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  return tempRoot;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeArchitectStatus(repoDir, patch = {}) {
  writeJson(path.join(repoDir, '.ask', 'runtime', 'architect-status.json'), {
    status: 'passed',
    blocking: false,
    reason: 'architecture guardrails satisfied',
    replayabilityRisk: 'low',
    architectureScore: {
      overallScore: 99,
    },
    ...patch,
  });
}

test('ask next prioritizes dependency-ready created task over OHDER recommendations', () => {
  const repoDir = setupRepo();
  writeArchitectStatus(repoDir, {
    status: 'failed',
    blocking: true,
    reason: 'architecture block should not override ready task',
  });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-a', '--title', 'Task A'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-b', '--title', 'Task B'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'depends', 'task-b', 'task-a'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'task-a'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'verify', 'pass', 'task-a', '--summary', 'validated'], { cwd: repoDir });

  const result = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.next.type, 'task-start');
  assert.equal(payload.next.taskId, 'task-b');
  assert.equal(Array.isArray(payload.tasks.ready), true);
});

test('ask next prioritizes in-progress task over OHDER recommendations', () => {
  const repoDir = setupRepo();
  writeArchitectStatus(repoDir, {
    status: 'failed',
    blocking: true,
    reason: 'architecture block should not override active task',
  });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-active', '--title', 'Active task'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'task-active'], { cwd: repoDir });

  const result = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.next.type, 'task-continue');
  assert.equal(payload.next.taskId, 'task-active');
});

test('ask next returns OHDER block action when no task is available', () => {
  const repoDir = setupRepo();
  writeArchitectStatus(repoDir, {
    status: 'failed',
    blocking: true,
    reason: 'ProjectionAuthority violated',
    architectureScore: {
      overallScore: 61,
    },
  });

  const result = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.next.type, 'ohder-action');
  assert.equal(payload.next.action, 'resolve-architecture-block');
  assert.equal(payload.next.blocking, true);
  assert.equal(payload.ohder.action, 'resolve-architecture-block');
  assert.equal(payload.ohder.architectureScore, 61);
});

test('ask next returns OHDER await-new-requirement action when architecture is healthy', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-done', '--title', 'Done task'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'task-done'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'complete', 'task-done'], { cwd: repoDir });
  writeArchitectStatus(repoDir, {
    status: 'passed',
    blocking: false,
    replayabilityRisk: 'low',
    architectureScore: {
      overallScore: 99,
    },
  });

  const result = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.next.type, 'ohder-action');
  assert.equal(payload.next.action, 'await-new-requirement');
  assert.equal(payload.ohder.action, 'await-new-requirement');
});
