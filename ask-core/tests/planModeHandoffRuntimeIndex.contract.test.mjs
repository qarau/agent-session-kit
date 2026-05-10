import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { AskPaths } from '../src/fs/AskPaths.js';
import { EventLedger } from '../src/runtime/EventLedger.js';
import { FileStore } from '../src/fs/FileStore.js';
import { PlanModeHandoffRuntime } from '../src/core/PlanModeHandoffRuntime.js';

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
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      `status=${String(result.status)}`,
      result.stdout,
      result.stderr,
    ].join('\n'));
  }
  return result;
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeJson(filePath, payload) {
  writeText(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-plan-mode-handoff-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  return tempRoot;
}

test('plan-mode handoff registers plan artifacts validates ingests and records durable state', async () => {
  const repoDir = setupRepo();
  const markdownPath = path.join(repoDir, 'docs', 'plans', 'handoff-plan.md');
  const jsonPath = path.join(repoDir, 'docs', 'plans', 'handoff-plan.json');

  writeText(markdownPath, '# Governed Plan\n\n## Slice 001\n\nBuild the handoff runtime.\n');
  writeJson(jsonPath, {
    schemaVersion: 2,
    planPrefix: 'pmh',
    planTitle: 'Plan Mode Handoff Contract',
    slices: [
      {
        sliceId: 'runtime',
        title: 'Build handoff runtime',
        description: 'Attach and ingest plan artifacts.',
        acceptanceCriteria: ['handoff records durable state'],
        queueClass: 'integrator',
      },
      {
        sliceId: 'docs',
        title: 'Document handoff runtime',
        description: 'Explain operator flow.',
        dependsOn: ['runtime'],
        queueClass: 'reviewer',
      },
    ],
  });

  const result = runOrThrow(process.execPath, [
    askBinPath,
    'plan-mode',
    'handoff',
    '--title',
    'Plan Mode Handoff Contract',
    '--source',
    'docs/plans/handoff-plan.md',
    '--plan-json',
    'docs/plans/handoff-plan.json',
    '--task',
    'plan-mode-handoff',
    '--run-id',
    'plan-mode-run',
    '--workflow',
    'superpowers',
    '--skill',
    'writing-plans',
  ], { cwd: repoDir });

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.createdTaskIds, ['pmh-001', 'pmh-002']);
  assert.equal(payload.nextTask.taskId, 'pmh-001');
  assert.equal(payload.state.status, 'ingested');
  assert.equal(typeof payload.planBatchId, 'string');
  assert.equal(typeof payload.artifactHash, 'string');

  const runtime = new PlanModeHandoffRuntime(repoDir);
  const state = await runtime.readState();
  assert.equal(state.latest.status, 'ingested');
  assert.equal(state.latest.taskId, 'plan-mode-handoff');
  assert.equal(state.latest.runId, 'plan-mode-run');
  assert.equal(state.latest.sourceMarkdownPath, 'docs/plans/handoff-plan.md');
  assert.equal(state.latest.planJsonPath, 'docs/plans/handoff-plan.json');
  assert.deepEqual(state.latest.createdTaskIds, ['pmh-001', 'pmh-002']);

  const paths = new AskPaths(repoDir);
  const store = new FileStore();
  const workflow = await store.readJson(paths.workflowSnapshot(), { tasks: {} });
  const artifacts = workflow.tasks['plan-mode-handoff'].runs['plan-mode-run'].artifacts;
  assert.ok(artifacts.some(artifact => artifact.type === 'plan-markdown' && artifact.path === 'docs/plans/handoff-plan.md'));
  assert.ok(artifacts.some(artifact => artifact.type === 'plan' && artifact.path === 'docs/plans/handoff-plan.json'));

  const batchShow = runOrThrow(process.execPath, [
    askBinPath,
    'plan',
    'batch',
    'show',
    payload.planBatchId,
  ], { cwd: repoDir });
  const batchPayload = JSON.parse(batchShow.stdout);
  assert.equal(batchPayload.ok, true);
  assert.equal(batchPayload.batch.planBatchId, payload.planBatchId);
  assert.equal(batchPayload.batch.artifactHash, payload.artifactHash);
  assert.deepEqual(batchPayload.batch.createdTaskIds, ['pmh-001', 'pmh-002']);

  const events = await new EventLedger(repoDir).readAll();
  const eventTypes = events.map(event => event.type);
  assert.ok(eventTypes.includes('PlanModeHandoffCreated'));
  assert.ok(eventTypes.includes('PlanModeHandoffValidated'));
  assert.ok(eventTypes.includes('PlanModeHandoffIngested'));
  const planIngested = events.find(event => event.type === 'PlanIngested');
  assert.equal(planIngested.payload.planBatchId, payload.planBatchId);
  assert.equal(planIngested.payload.artifactHash, payload.artifactHash);
  assert.ok(events.some(event => event.type === 'PlanSliceMaterialized' && event.payload.planBatchId === payload.planBatchId));
});
