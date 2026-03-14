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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-integration-runtime-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Integration target'], { cwd: repoDir });
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

function readIntegrationSnapshot(repoDir) {
  const filePath = path.join(repoDir, '.ask', 'runtime', 'snapshots', 'integration.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readMergeReadinessSnapshot(repoDir) {
  const filePath = path.join(repoDir, '.ask', 'runtime', 'snapshots', 'merge-readiness.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('integration plan run status emits expected events and snapshots', () => {
  const repoDir = setupRepo();

  const planned = runOrThrow(
    process.execPath,
    [askBinPath, 'integration', 'plan', 'task-1', '--run-id', 'run-1', '--base', 'main', '--head', 'ask-runtime'],
    { cwd: repoDir }
  );
  const plannedPayload = JSON.parse(planned.stdout);
  assert.equal(plannedPayload.ok, true);
  assert.equal(plannedPayload.plan.runId, 'run-1');

  const runResult = runOrThrow(
    process.execPath,
    [askBinPath, 'integration', 'run', 'task-1', '--run-id', 'run-1', '--command', 'node -e "process.exit(0)"'],
    { cwd: repoDir }
  );
  const runPayload = JSON.parse(runResult.stdout);
  assert.equal(runPayload.ok, true);
  assert.equal(runPayload.run.status, 'passed');

  const status = runOrThrow(process.execPath, [askBinPath, 'integration', 'status', 'task-1'], { cwd: repoDir });
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, true);
  assert.equal(statusPayload.integration.latestRun.status, 'passed');

  const integration = readIntegrationSnapshot(repoDir);
  assert.equal(integration.tasks['task-1'].latestRun.status, 'passed');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('IntegrationPlanCreated'));
  assert.ok(eventTypes.includes('IntegrationRunStarted'));
  assert.ok(eventTypes.includes('IntegrationRunPassed'));
});

test('auto integration emits pass fail outcomes and evidence attachment', () => {
  const repoDir = setupRepo();

  const passed = runOrThrow(
    process.execPath,
    [askBinPath, 'integration-auto', 'run', 'task-1', '--run-id', 'auto-pass', '--command', 'node -e "process.exit(0)"'],
    { cwd: repoDir }
  );
  const passPayload = JSON.parse(passed.stdout);
  assert.equal(passPayload.ok, true);
  assert.equal(passPayload.run.status, 'passed');

  const failed = run(
    process.execPath,
    [askBinPath, 'integration-auto', 'run', 'task-1', '--run-id', 'auto-fail', '--command', 'node -e "process.exit(1)"'],
    { cwd: repoDir }
  );
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  const failPayload = JSON.parse(failed.stdout);
  assert.equal(failPayload.ok, false);
  assert.equal(failPayload.run.status, 'failed');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('IntegrationRunPassed'));
  assert.ok(eventTypes.includes('IntegrationRunFailed'));
  const evidenceCount = eventTypes.filter(type => type === 'EvidenceAttached').length;
  assert.ok(evidenceCount >= 2);
});

test('merge readiness revokes when integration is missing or failed', () => {
  const repoDir = setupRepo();

  const initialStatus = runOrThrow(process.execPath, [askBinPath, 'integration', 'status', 'task-1'], { cwd: repoDir });
  const initialPayload = JSON.parse(initialStatus.stdout);
  assert.equal(initialPayload.ok, true);
  assert.equal(initialPayload.mergeReadiness.status, 'revoked');
  assert.equal(initialPayload.mergeReadiness.reasonCode, 'integration-missing');

  runOrThrow(
    process.execPath,
    [askBinPath, 'integration', 'run', 'task-1', '--run-id', 'run-pass', '--command', 'node -e "process.exit(0)"'],
    { cwd: repoDir }
  );

  const passStatus = runOrThrow(process.execPath, [askBinPath, 'integration', 'status', 'task-1'], { cwd: repoDir });
  const passPayload = JSON.parse(passStatus.stdout);
  assert.equal(passPayload.ok, true);
  assert.equal(passPayload.mergeReadiness.status, 'ready');
  assert.equal(passPayload.mergeReadiness.reasonCode, 'integration-passed');

  const failRun = run(
    process.execPath,
    [askBinPath, 'integration', 'run', 'task-1', '--run-id', 'run-fail', '--command', 'node -e "process.exit(1)"'],
    { cwd: repoDir }
  );
  assert.equal(failRun.status, 1, failRun.stdout + failRun.stderr);

  const finalStatus = runOrThrow(process.execPath, [askBinPath, 'integration', 'status', 'task-1'], { cwd: repoDir });
  const finalPayload = JSON.parse(finalStatus.stdout);
  assert.equal(finalPayload.ok, true);
  assert.equal(finalPayload.mergeReadiness.status, 'revoked');
  assert.equal(finalPayload.mergeReadiness.reasonCode, 'integration-failed');

  const mergeReadiness = readMergeReadinessSnapshot(repoDir);
  assert.equal(mergeReadiness.tasks['task-1'].status, 'revoked');
  assert.equal(mergeReadiness.tasks['task-1'].reasonCode, 'integration-failed');
});
