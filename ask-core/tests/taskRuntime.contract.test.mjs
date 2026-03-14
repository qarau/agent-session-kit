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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-task-runtime-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  return tempRoot;
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

test('task CLI create assign start status flow projects runtime task snapshot', () => {
  const repoDir = setupRepo();

  const created = runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Implement runtime'], {
    cwd: repoDir,
  });
  const assigned = runOrThrow(process.execPath, [askBinPath, 'task', 'assign', 'task-1', '--owner', 'codex'], {
    cwd: repoDir,
  });
  const started = runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'task-1'], { cwd: repoDir });

  const createdPayload = JSON.parse(created.stdout);
  const assignedPayload = JSON.parse(assigned.stdout);
  const startedPayload = JSON.parse(started.stdout);

  assert.equal(createdPayload.ok, true);
  assert.equal(assignedPayload.ok, true);
  assert.equal(startedPayload.ok, true);

  const statusOne = runOrThrow(process.execPath, [askBinPath, 'task', 'status', 'task-1'], { cwd: repoDir });
  const statusAll = runOrThrow(process.execPath, [askBinPath, 'task', 'status'], { cwd: repoDir });

  const single = JSON.parse(statusOne.stdout);
  const all = JSON.parse(statusAll.stdout);

  assert.equal(single.ok, true);
  assert.equal(single.task.taskId, 'task-1');
  assert.equal(single.task.title, 'Implement runtime');
  assert.equal(single.task.owner, 'codex');
  assert.equal(single.task.status, 'in-progress');

  assert.equal(all.ok, true);
  assert.equal(all.tasks['task-1'].status, 'in-progress');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('TaskCreated'));
  assert.ok(eventTypes.includes('TaskAssigned'));
  assert.ok(eventTypes.includes('TaskStarted'));
});

test('invalid task transition is rejected before event append', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Implement runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'task-1'], { cwd: repoDir });

  const before = readEvents(repoDir).length;
  const secondStart = run(process.execPath, [askBinPath, 'task', 'start', 'task-1'], { cwd: repoDir });
  const after = readEvents(repoDir).length;

  assert.equal(secondStart.status, 1, secondStart.stdout + secondStart.stderr);
  const payload = JSON.parse(secondStart.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'invalid-task-transition');
  assert.equal(before, after);
});
