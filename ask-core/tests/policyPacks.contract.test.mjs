import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { TaskClassifier } from '../src/core/TaskClassifier.js';

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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-policy-packs-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Policy target'], { cwd: repoDir });
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

function readSnapshot(repoDir, name) {
  return JSON.parse(fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'snapshots', name), 'utf8'));
}

test('task classifier maps contexts to planner implementer verifier debugger integrator reviewer', () => {
  const classifier = new TaskClassifier();

  assert.equal(classifier.classify({ task: { status: 'created' } }), 'planner');
  assert.equal(classifier.classify({ task: { status: 'in-progress' } }), 'implementer');
  assert.equal(
    classifier.classify({
      task: { status: 'completed' },
      verification: { status: 'unknown' },
    }),
    'verifier'
  );
  assert.equal(
    classifier.classify({
      task: { status: 'completed' },
      verification: { status: 'failed' },
    }),
    'debugger'
  );
  assert.equal(
    classifier.classify({
      task: { status: 'completed' },
      verification: { status: 'passed' },
      mergeReadiness: { status: 'revoked' },
    }),
    'integrator'
  );
  assert.equal(
    classifier.classify({
      task: { status: 'completed' },
      verification: { status: 'passed' },
      mergeReadiness: { status: 'ready' },
    }),
    'reviewer'
  );
});

test('policy apply emits hold and dispatch decisions', () => {
  const repoDir = setupRepo();

  const dispatch = runOrThrow(process.execPath, [askBinPath, 'policy', 'apply', 'task-1', '--queue-class', 'planner'], {
    cwd: repoDir,
  });
  const dispatchPayload = JSON.parse(dispatch.stdout);
  assert.equal(dispatchPayload.ok, true);
  assert.equal(dispatchPayload.decision.action, 'dispatch');
  assert.equal(dispatchPayload.decision.queueClass, 'planner');

  const hold = runOrThrow(process.execPath, [askBinPath, 'policy', 'apply', 'task-1', '--queue-class', 'reviewer'], {
    cwd: repoDir,
  });
  const holdPayload = JSON.parse(hold.stdout);
  assert.equal(holdPayload.ok, true);
  assert.equal(holdPayload.decision.action, 'hold');
  assert.equal(holdPayload.decision.queueClass, 'reviewer');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('TaskClassified'));
  assert.ok(eventTypes.includes('PolicyDecisionRecorded'));
});

test('policy snapshots are written deterministically for queue and pack decisions', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'policy', 'classify', 'task-1', '--queue-class', 'debugger'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'policy', 'apply', 'task-1', '--queue-class', 'debugger'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'policy', 'apply', 'task-1', '--queue-class', 'reviewer'], { cwd: repoDir });

  const queueClasses = readSnapshot(repoDir, 'queue-classes.json');
  const policyPacks = readSnapshot(repoDir, 'policy-packs.json');

  assert.equal(queueClasses.tasks['task-1'].latestClass, 'reviewer');
  assert.equal(queueClasses.tasks['task-1'].history.length, 3);
  assert.equal(queueClasses.tasks['task-1'].history[0].queueClass, 'debugger');

  assert.equal(policyPacks.tasks['task-1'].latestDecision.action, 'hold');
  assert.equal(policyPacks.tasks['task-1'].latestDecision.queueClass, 'reviewer');
  assert.equal(policyPacks.tasks['task-1'].decisions.length, 2);
  assert.equal(policyPacks.tasks['task-1'].decisions[0].action, 'dispatch');
});
