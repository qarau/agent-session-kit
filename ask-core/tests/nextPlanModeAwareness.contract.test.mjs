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

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-next-plan-mode-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  return tempRoot;
}

function writeHandoffState(repoDir, latest) {
  writeJson(path.join(repoDir, '.ask', 'runtime', 'plan-mode-handoff.json'), {
    schemaVersion: 1,
    latest,
    handoffs: [latest],
  });
}

test('ask next surfaces pending plan-mode handoff before generic task routing', () => {
  const repoDir = setupRepo();
  writeHandoffState(repoDir, {
    status: 'validation-failed',
    title: 'Broken Plan',
    taskId: 'plan-source',
    runId: 'run-plan',
    sourceMarkdownPath: 'docs/plans/broken.md',
    planJsonPath: 'docs/plans/broken.json',
    error: { code: 'E_PLAN_SCHEMA_INVALID', message: 'plan artifact is invalid' },
  });

  const result = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.next.type, 'plan-mode-handoff');
  assert.equal(payload.next.action, 'ask plan validate --task plan-source --run-id run-plan --path docs/plans/broken.json');
  assert.equal(payload.planModeHandoff.status, 'validation-failed');
  assert.match(payload.next.reason, /plan artifact is invalid/);
});

test('ask next includes ingested handoff guidance while prioritizing generated slice start', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'pmh-001', '--title', 'Generated slice'], { cwd: repoDir });
  writeHandoffState(repoDir, {
    status: 'ingested',
    title: 'Ready Plan',
    taskId: 'plan-source',
    runId: 'run-plan',
    planBatchId: 'pmh-test-001',
    createdTaskIds: ['pmh-001'],
    nextTaskId: 'pmh-001',
  });

  const result = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.next.type, 'task-start');
  assert.equal(payload.next.action, 'ask task start pmh-001');
  assert.equal(payload.next.reason, 'plan-mode handoff ready; start generated ASK slice');
  assert.equal(payload.planModeHandoff.status, 'ingested');
  assert.equal(payload.planModeHandoff.nextTaskId, 'pmh-001');
});
