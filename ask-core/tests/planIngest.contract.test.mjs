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

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-plan-ingest-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-plan', '--title', 'Plan source task'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'task-plan'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'task', 'complete', 'task-plan'], { cwd: tempRoot });
  return tempRoot;
}

function attachPlanArtifact(repoDir, runId, fileName, planPayload) {
  const relativePath = path.join('plans', fileName).replaceAll('\\', '/');
  writeJson(path.join(repoDir, relativePath), planPayload);
  runOrThrow(process.execPath, [
    askBinPath,
    'workflow',
    'start',
    'task-plan',
    '--workflow',
    'superpowers',
    '--skill',
    'writing-plans',
    '--run-id',
    runId,
  ], { cwd: repoDir });
  runOrThrow(process.execPath, [
    askBinPath,
    'workflow',
    'artifact',
    'task-plan',
    '--run-id',
    runId,
    '--type',
    'plan',
    '--path',
    relativePath,
    '--summary',
    'plan artifact',
  ], { cwd: repoDir });
  return relativePath;
}

function readTaskStatus(repoDir, taskId) {
  const status = runOrThrow(process.execPath, [askBinPath, 'task', 'status', taskId], { cwd: repoDir });
  return JSON.parse(status.stdout).task;
}

function readEvents(repoDir) {
  const filePath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    return [];
  }
  return raw.split(/\r?\n/u).map(line => JSON.parse(line));
}

function readQueueClasses(repoDir) {
  return JSON.parse(
    fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'snapshots', 'queue-classes.json'), 'utf8')
  );
}

function basePlan() {
  return {
    schemaVersion: 2,
    planPrefix: 'deep',
    planTitle: 'Deep Ingest Contract',
    slices: [
      {
        sliceId: 'schema',
        title: 'Define schema',
        description: 'Create schema layer',
        acceptanceCriteria: ['schema compiles'],
        queueClass: 'planner',
      },
      {
        sliceId: 'runtime',
        title: 'Implement runtime',
        description: 'Build runtime layer',
        dependsOn: ['schema'],
        queueClass: 'integrator',
      },
      {
        title: 'Publish docs',
        description: 'Document behavior',
      },
    ],
  };
}

test('plan validate previews deterministic materialization graph', () => {
  const repoDir = setupRepo();
  attachPlanArtifact(repoDir, 'run-plan-1', 'plan-1.json', basePlan());

  const result = runOrThrow(process.execPath, [
    askBinPath,
    'plan',
    'validate',
    '--task',
    'task-plan',
    '--run-id',
    'run-plan-1',
  ], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.sliceCount, 3);
  assert.equal(payload.slices[0].taskId, 'deep-001');
  assert.equal(payload.slices[1].dependencies[0], 'deep-001');
  assert.equal(payload.slices[2].dependencies[0], 'deep-002');
});

test('plan ingest materializes tasks dependencies queue-class hints and batch metadata', () => {
  const repoDir = setupRepo();
  attachPlanArtifact(repoDir, 'run-plan-2', 'plan-2.json', basePlan());

  const ingested = runOrThrow(process.execPath, [
    askBinPath,
    'plan',
    'ingest',
    '--task',
    'task-plan',
    '--run-id',
    'run-plan-2',
  ], { cwd: repoDir });
  const payload = JSON.parse(ingested.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.createdTaskIds, ['deep-001', 'deep-002', 'deep-003']);

  const first = readTaskStatus(repoDir, 'deep-001');
  const second = readTaskStatus(repoDir, 'deep-002');
  const third = readTaskStatus(repoDir, 'deep-003');
  assert.equal(first.status, 'created');
  assert.equal(first.origin.type, 'plan-ingest');
  assert.deepEqual(second.dependencies, ['deep-001']);
  assert.deepEqual(third.dependencies, ['deep-002']);

  const queueClasses = readQueueClasses(repoDir);
  assert.equal(queueClasses.tasks['deep-001'].latestClass, 'planner');
  assert.equal(queueClasses.tasks['deep-002'].latestClass, 'integrator');

  const next = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const nextPayload = JSON.parse(next.stdout);
  assert.equal(nextPayload.next.type, 'task-start');
  assert.equal(nextPayload.next.taskId, 'deep-001');

  const batchShow = runOrThrow(process.execPath, [askBinPath, 'plan', 'batch', 'show', payload.planBatchId], { cwd: repoDir });
  const batchPayload = JSON.parse(batchShow.stdout);
  assert.equal(batchPayload.ok, true);
  assert.deepEqual(batchPayload.batch.createdTaskIds, ['deep-001', 'deep-002', 'deep-003']);

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('PlanIngested'));
  assert.ok(eventTypes.includes('PlanSliceMaterialized'));
});

test('plan ingest enforces strict idempotency with force override', () => {
  const repoDir = setupRepo();
  attachPlanArtifact(repoDir, 'run-plan-3', 'plan-3.json', basePlan());

  const first = runOrThrow(process.execPath, [
    askBinPath,
    'plan',
    'ingest',
    '--task',
    'task-plan',
    '--run-id',
    'run-plan-3',
  ], { cwd: repoDir });
  const firstPayload = JSON.parse(first.stdout);
  assert.equal(firstPayload.ok, true);

  const duplicate = run(process.execPath, [
    askBinPath,
    'plan',
    'ingest',
    '--task',
    'task-plan',
    '--run-id',
    'run-plan-3',
  ], { cwd: repoDir });
  assert.equal(duplicate.status, 1, duplicate.stdout + duplicate.stderr);
  const duplicatePayload = JSON.parse(duplicate.stdout);
  assert.equal(duplicatePayload.code, 'E_PLAN_DUPLICATE_INGEST');

  const forced = runOrThrow(process.execPath, [
    askBinPath,
    'plan',
    'ingest',
    '--task',
    'task-plan',
    '--run-id',
    'run-plan-3',
    '--force-new-batch',
  ], { cwd: repoDir });
  const forcedPayload = JSON.parse(forced.stdout);
  assert.equal(forcedPayload.ok, true);
  assert.deepEqual(forcedPayload.createdTaskIds, ['deep-004', 'deep-005', 'deep-006']);
});

test('plan ingest --dry-run validates but does not write runtime events', () => {
  const repoDir = setupRepo();
  attachPlanArtifact(repoDir, 'run-plan-4', 'plan-4.json', basePlan());

  const before = readEvents(repoDir).length;
  const dryRun = runOrThrow(process.execPath, [
    askBinPath,
    'plan',
    'ingest',
    '--task',
    'task-plan',
    '--run-id',
    'run-plan-4',
    '--dry-run',
  ], { cwd: repoDir });
  const after = readEvents(repoDir).length;
  const payload = JSON.parse(dryRun.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.dryRun, true);
  assert.equal(before, after);
});

test('plan ingest fails atomically for unknown dependency targets', () => {
  const repoDir = setupRepo();
  const invalidPlan = basePlan();
  invalidPlan.slices[1].dependsOn = ['missing-slice-id'];
  attachPlanArtifact(repoDir, 'run-plan-5', 'plan-5.json', invalidPlan);

  const before = readEvents(repoDir).length;
  const result = run(process.execPath, [
    askBinPath,
    'plan',
    'ingest',
    '--task',
    'task-plan',
    '--run-id',
    'run-plan-5',
  ], { cwd: repoDir });
  const after = readEvents(repoDir).length;
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.code, 'E_PLAN_DEPENDENCY_UNKNOWN');
  assert.equal(before, after);
});
