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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-freshness-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-a', '--title', 'Task A'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-b', '--title', 'Task B'], { cwd: repoDir });
  return repoDir;
}

function readEvents(repoDir) {
  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  const raw = fs.readFileSync(eventsPath, 'utf8').trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

test('task depends records TaskDependencyAdded event and task dependency snapshot', () => {
  const repoDir = setupRepo();

  const result = runOrThrow(process.execPath, [askBinPath, 'task', 'depends', 'task-a', 'task-b'], {
    cwd: repoDir,
  });
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.deepEqual(payload.task.dependencies, ['task-b']);

  const events = readEvents(repoDir);
  const dependencyEvent = events.find(event => event.type === 'TaskDependencyAdded');
  assert.ok(dependencyEvent);
  assert.equal(dependencyEvent.taskId, 'task-a');
  assert.equal(dependencyEvent.payload.dependencyTaskId, 'task-b');
});

test('freshness becomes stale when dependency changes after verification pass', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'task', 'depends', 'task-a', 'task-b'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'verify', 'pass', 'task-a', '--summary', 'initial pass'], { cwd: repoDir });

  const freshStatus = runOrThrow(process.execPath, [askBinPath, 'freshness', 'status', 'task-a'], {
    cwd: repoDir,
  });
  const freshPayload = JSON.parse(freshStatus.stdout);
  assert.equal(freshPayload.ok, true);
  assert.equal(freshPayload.status, 'fresh');

  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'task-b'], { cwd: repoDir });

  const staleStatus = runOrThrow(process.execPath, [askBinPath, 'freshness', 'status', 'task-a'], {
    cwd: repoDir,
  });
  const stalePayload = JSON.parse(staleStatus.stdout);
  assert.equal(stalePayload.ok, true);
  assert.equal(stalePayload.status, 'stale');
  assert.equal(stalePayload.reasonCode, 'dependency-updated-after-verification');
  assert.deepEqual(stalePayload.blockingDependencies, ['task-b']);
});

test('freshness status and explain return deterministic explanation payload', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'task', 'depends', 'task-a', 'task-b'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'verify', 'pass', 'task-a', '--summary', 'initial pass'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'task-b'], { cwd: repoDir });

  const statusResult = runOrThrow(process.execPath, [askBinPath, 'freshness', 'status', 'task-a'], {
    cwd: repoDir,
  });
  const explainResult = runOrThrow(process.execPath, [askBinPath, 'freshness', 'explain', 'task-a'], {
    cwd: repoDir,
  });

  const statusPayload = JSON.parse(statusResult.stdout);
  const explainPayload = JSON.parse(explainResult.stdout);

  assert.equal(statusPayload.ok, true);
  assert.equal(explainPayload.ok, true);
  assert.equal(statusPayload.taskId, 'task-a');
  assert.equal(explainPayload.taskId, 'task-a');
  assert.equal(statusPayload.status, 'stale');
  assert.equal(explainPayload.status, 'stale');
  assert.equal(statusPayload.reasonCode, 'dependency-updated-after-verification');
  assert.equal(explainPayload.reasonCode, 'dependency-updated-after-verification');
  assert.deepEqual(statusPayload.blockingDependencies, ['task-b']);
  assert.deepEqual(explainPayload.blockingDependencies, ['task-b']);
  assert.equal(typeof explainPayload.explanation, 'string');
  assert.ok(explainPayload.explanation.includes('task-b'));
});
