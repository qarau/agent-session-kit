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

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function setupRepo(branchName = 'main') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-pre-commit-implementation-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', branchName], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  writeJson(path.join(tempRoot, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: branchName,
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    strictTasksDoc: false,
  });
  return tempRoot;
}

function makeHealthyPreCommitState(repoDir) {
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  runOrThrow(process.execPath, [
    askBinPath,
    'codex',
    '--command',
    process.execPath,
    '--command-arg',
    '-e',
    '--command-arg',
    'process.exit(0)',
    '--operation',
    'pre-commit-implementation-proof',
  ], { cwd: repoDir });
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh: true,
    testsPassed: true,
    checks: ['unit-tests', 'docs-freshness'],
  });
}

function writePlanModeHandoffState(repoDir, nextTaskId = 'pmh-001') {
  writeJson(path.join(repoDir, '.ask', 'runtime', 'plan-mode-handoff.json'), {
    schemaVersion: 1,
    latest: {
      status: 'ingested',
      taskId: 'plan-source',
      runId: 'run-plan',
      planBatchId: 'pmh-test-001',
      createdTaskIds: [nextTaskId],
      nextTaskId,
    },
    handoffs: [],
  });
}

function stageImplementationChange(repoDir) {
  writeText(path.join(repoDir, 'src', 'feature.js'), 'export const feature = true;\n');
  writeText(path.join(repoDir, 'docs', 'session', 'current-status.md'), 'Current status is fresh.\n');
  writeText(path.join(repoDir, 'docs', 'session', 'change-log.md'), 'Change log is fresh.\n');
  runOrThrow('git', ['add', 'src/feature.js', 'docs/session/current-status.md', 'docs/session/change-log.md'], { cwd: repoDir });
}

test('pre-commit-check blocks staged implementation when no ASK slice is active', () => {
  const repoDir = setupRepo('main');
  makeHealthyPreCommitState(repoDir);
  writePlanModeHandoffState(repoDir, 'pmh-001');
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'pmh-001', '--title', 'Pending slice'], { cwd: repoDir });
  stageImplementationChange(repoDir);

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, false);
  assert.ok(payload.checks.includes('implementation-preflight'));
  assert.match(JSON.stringify(payload.missing), /active-ask-slice/i);
  assert.equal(payload.implementationPreflight.recovery.command, 'ask task start pmh-001');
});

test('pre-commit-check allows staged implementation with active slice or slice-close marker', () => {
  const repoDir = setupRepo('main');
  makeHealthyPreCommitState(repoDir);
  writePlanModeHandoffState(repoDir, 'pmh-001');
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'pmh-001', '--title', 'Active slice'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'pmh-001'], { cwd: repoDir });
  stageImplementationChange(repoDir);

  const active = runOrThrow(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  const activePayload = JSON.parse(active.stdout);
  assert.equal(activePayload.passed, true);
  assert.equal(activePayload.implementationPreflight.passed, true);

  runOrThrow(process.execPath, [askBinPath, 'task', 'complete', 'pmh-001'], { cwd: repoDir });
  const marker = runOrThrow(process.execPath, [askBinPath, 'pre-commit-check'], {
    cwd: repoDir,
    env: { ASK_SLICE_CLOSE_TASK_ID: 'pmh-001' },
  });
  const markerPayload = JSON.parse(marker.stdout);
  assert.equal(markerPayload.passed, true);
  assert.equal(markerPayload.implementationPreflight.sliceCloseProvenance.taskId, 'pmh-001');
});
