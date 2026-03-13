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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-workflow-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Workflow integration'], { cwd: tempRoot });
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

function readWorkflowSnapshot(repoDir) {
  return JSON.parse(fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'snapshots', 'workflow.json'), 'utf8'));
}

test('workflow recommend returns canonical superpowers skill id and snapshots recommendation', () => {
  const repoDir = setupRepo();

  const recommended = runOrThrow(process.execPath, [askBinPath, 'workflow', 'recommend', 'task-1'], { cwd: repoDir });
  const payload = JSON.parse(recommended.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.recommendation.workflow, 'superpowers');
  assert.equal(payload.recommendation.skill, 'writing-plans');
  assert.doesNotMatch(payload.recommendation.skill, /[\\/]/u);

  const workflow = readWorkflowSnapshot(repoDir);
  assert.equal(workflow.tasks['task-1'].recommendation.skill, 'writing-plans');

  const types = readEvents(repoDir).map(event => event.type);
  assert.ok(types.includes('WorkflowRecommended'));
});

test('workflow start artifact complete fail commands update workflow projection', () => {
  const repoDir = setupRepo();

  runOrThrow(
    process.execPath,
    [askBinPath, 'workflow', 'start', 'task-1', '--workflow', 'superpowers', '--skill', 'writing-plans', '--run-id', 'run-1'],
    { cwd: repoDir }
  );
  runOrThrow(
    process.execPath,
    [askBinPath, 'workflow', 'artifact', 'task-1', '--run-id', 'run-1', '--type', 'plan', '--path', 'docs/plans/task-1.md', '--summary', 'draft'],
    { cwd: repoDir }
  );
  runOrThrow(
    process.execPath,
    [askBinPath, 'workflow', 'complete', 'task-1', '--run-id', 'run-1', '--summary', 'done'],
    { cwd: repoDir }
  );
  runOrThrow(
    process.execPath,
    [askBinPath, 'workflow', 'start', 'task-1', '--workflow', 'superpowers', '--skill', 'executing-plans', '--run-id', 'run-2'],
    { cwd: repoDir }
  );
  runOrThrow(
    process.execPath,
    [askBinPath, 'workflow', 'fail', 'task-1', '--run-id', 'run-2', '--summary', 'blocked'],
    { cwd: repoDir }
  );

  const workflow = readWorkflowSnapshot(repoDir);
  assert.equal(workflow.tasks['task-1'].runs['run-1'].status, 'completed');
  assert.equal(workflow.tasks['task-1'].runs['run-1'].artifacts.length, 1);
  assert.equal(workflow.tasks['task-1'].runs['run-2'].status, 'failed');

  const types = readEvents(repoDir).map(event => event.type);
  assert.ok(types.includes('WorkflowRunStarted'));
  assert.ok(types.includes('WorkflowArtifactRecorded'));
  assert.ok(types.includes('WorkflowRunCompleted'));
  assert.ok(types.includes('WorkflowRunFailed'));
});
