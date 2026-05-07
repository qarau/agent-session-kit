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

function setupRepo(branchName = 'ask-runtime') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-slice-close-'));
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
    governanceMode: 'project',
    strictTasksDoc: false,
  });
  runOrThrow('git', ['add', '.'], { cwd: tempRoot });
  runOrThrow('git', ['commit', '-m', 'baseline'], { cwd: tempRoot });
  runOrThrow('git', ['branch', 'main'], { cwd: tempRoot });
  return tempRoot;
}

function prepareGovernedSession(repoDir) {
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'slice-close-governed-proof',
    ],
    { cwd: repoDir }
  );
  runOrThrow(
    process.execPath,
    [askBinPath, 'evidence', 'checks', 'record', '--tests-passed', 'true', '--docs-fresh', 'true', '--checks', 'unit-tests,docs-freshness'],
    { cwd: repoDir }
  );
}

function createInProgressTask(repoDir, taskId, title = 'Close slice task') {
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', taskId, '--title', title], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'start', taskId], { cwd: repoDir });
}

function readTaskStatus(repoDir, taskId) {
  const result = runOrThrow(process.execPath, [askBinPath, 'task', 'status', taskId], { cwd: repoDir });
  return JSON.parse(result.stdout).task.status;
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

function readNdjson(repoDir, relativePath) {
  const filePath = path.join(repoDir, relativePath);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function setFastFullSuiteCommand(repoDir, commandSnippet = 'process.exit(0)') {
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  const raw = fs.readFileSync(policyPath, 'utf8');
  const updated = raw
    .replace('full_suite_command: npm', 'full_suite_command: node')
    .replace('full_suite_args: test', `full_suite_args: -e,${commandSnippet}`);
  fs.writeFileSync(policyPath, updated, 'utf8');
}

function writeBlockingOhderLawPack(repoDir) {
  writeJson(path.join(repoDir, '.ask', 'policy', 'ohder-law-pack.json'), {
    version: 1,
    defaultOutcomes: {
      critical: 'block',
      high: 'retry',
      medium: 'warn',
      low: 'warn',
    },
    laws: [
      {
        id: 'test-slice-close-block',
        name: 'Test Slice Close Block',
        enabled: true,
        severity: 'critical',
        metric: 'operation',
        operator: '==',
        value: 'never-allowed-operation',
        outcome: 'block',
        message: 'test law blocks slice close',
      },
    ],
    exemptions: [],
  });
}

test('slice close auto-completes auto-commits and passes pre-push checks', () => {
  const repoDir = setupRepo();
  prepareGovernedSession(repoDir);
  createInProgressTask(repoDir, 'slice-001');

  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'slice-001.js'), 'export const slice001 = true;\n', 'utf8');

  const closeResult = run(process.execPath, [askBinPath, 'slice', 'close', 'slice-001'], { cwd: repoDir });
  assert.equal(closeResult.status, 0, closeResult.stdout + closeResult.stderr);
  const payload = JSON.parse(closeResult.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.task.status, 'completed');
  assert.equal(payload.prePush.passed, true);
  assert.equal(typeof payload.commit.sha, 'string');
  assert.equal(payload.architect.blocking, false);
  assert.equal(typeof payload.architect.status, 'string');

  const commitMessage = runOrThrow('git', ['log', '-1', '--pretty=%B'], { cwd: repoDir }).stdout;
  assert.match(commitMessage, /ASK-Slice:\s*slice-001/i);

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('ArchitectValidationCompleted'));
  assert.ok(eventTypes.includes('ReplayabilityValidated'));
  assert.ok(eventTypes.includes('EntropyImpactMeasured'));
  assert.ok(eventTypes.includes('EntropyTrendChanged'));

  const history = readNdjson(repoDir, path.join('.ask', 'runtime', 'metrics-history.ndjson'));
  assert.equal(history.length >= 1, true);
  const latestHistory = history.at(-1);
  assert.equal(latestHistory.source, 'slice-close');
  assert.equal(latestHistory.sliceId, 'slice-001');
  assert.equal(typeof latestHistory.entropyDelta, 'number');
  assert.equal(typeof latestHistory.couplingDelta, 'number');
  assert.equal(typeof latestHistory.replayabilityRisk, 'string');
  assert.equal(typeof latestHistory.architectureScore, 'number');
  assert.equal(typeof latestHistory.entropyScore, 'number');

  const driftAnalytics = JSON.parse(fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'drift-analytics.json'), 'utf8'));
  assert.equal(driftAnalytics.windowSize >= 1, true);
  assert.equal(typeof driftAnalytics.overall.trend, 'string');
});

test('slice close rolls task back to in-progress when commit cannot be created', () => {
  const repoDir = setupRepo();
  prepareGovernedSession(repoDir);
  createInProgressTask(repoDir, 'slice-002');

  runOrThrow('git', ['config', 'core.hooksPath', '.githooks'], { cwd: repoDir });
  fs.mkdirSync(path.join(repoDir, '.githooks'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, '.githooks', 'pre-commit'), '#!/usr/bin/env sh\nexit 1\n', 'utf8');

  const closeResult = run(process.execPath, [askBinPath, 'slice', 'close', 'slice-002'], { cwd: repoDir });
  assert.equal(closeResult.status, 1, closeResult.stdout + closeResult.stderr);
  const payload = JSON.parse(closeResult.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'slice-close-commit-failed');
  assert.equal(readTaskStatus(repoDir, 'slice-002'), 'in-progress');
});

test('slice close requires full-suite on integrator lane and records pass', () => {
  const repoDir = setupRepo();
  prepareGovernedSession(repoDir);
  createInProgressTask(repoDir, 'slice-003');
  setFastFullSuiteCommand(repoDir);
  runOrThrow(process.execPath, [askBinPath, 'policy', 'classify', 'slice-003', '--queue-class', 'integrator'], {
    cwd: repoDir,
  });

  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'slice-003.js'), 'export const slice003 = true;\n', 'utf8');

  const closeResult = run(process.execPath, [askBinPath, 'slice', 'close', 'slice-003'], { cwd: repoDir });
  assert.equal(closeResult.status, 0, closeResult.stdout + closeResult.stderr);
  const payload = JSON.parse(closeResult.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.fullSuite.required, true);
  assert.equal(payload.fullSuite.command, 'node');
  assert.equal(payload.fullSuite.status, 0);
  assert.equal(payload.architect.blocking, false);
});

test('slice close rejects pre-staged work before completing the task', () => {
  const repoDir = setupRepo();
  prepareGovernedSession(repoDir);
  createInProgressTask(repoDir, 'slice-005');

  fs.mkdirSync(path.join(repoDir, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'notes', 'unrelated.md'), 'unrelated staged work\n', 'utf8');
  runOrThrow('git', ['add', 'notes/unrelated.md'], { cwd: repoDir });

  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'slice-005.js'), 'export const slice005 = true;\n', 'utf8');

  const closeResult = run(process.execPath, [askBinPath, 'slice', 'close', 'slice-005'], { cwd: repoDir });
  assert.equal(closeResult.status, 1, closeResult.stdout + closeResult.stderr);
  const payload = JSON.parse(closeResult.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'slice-close-dirty-index');
  assert.deepEqual(payload.stagedFiles, ['notes/unrelated.md']);
  assert.equal(readTaskStatus(repoDir, 'slice-005'), 'in-progress');

  const staged = runOrThrow('git', ['diff', '--cached', '--name-only'], { cwd: repoDir }).stdout.trim();
  assert.equal(staged, 'notes/unrelated.md');
});

test('slice close blocks before completing task when OHDER assessment blocks', () => {
  const repoDir = setupRepo();
  prepareGovernedSession(repoDir);
  createInProgressTask(repoDir, 'slice-006');
  writeBlockingOhderLawPack(repoDir);

  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'slice-006.js'), 'export const slice006 = true;\n', 'utf8');
  const headBefore = runOrThrow('git', ['rev-parse', 'HEAD'], { cwd: repoDir }).stdout.trim();

  const closeResult = run(process.execPath, [askBinPath, 'slice', 'close', 'slice-006'], { cwd: repoDir });
  assert.equal(closeResult.status, 1, closeResult.stdout + closeResult.stderr);
  const payload = JSON.parse(closeResult.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'slice-close-ohder-blocked');
  assert.equal(payload.architect.blocking, true);
  assert.equal(payload.architect.lawViolations.length, 1);
  assert.equal(readTaskStatus(repoDir, 'slice-006'), 'in-progress');

  const headAfter = runOrThrow('git', ['rev-parse', 'HEAD'], { cwd: repoDir }).stdout.trim();
  assert.equal(headAfter, headBefore);

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('ArchitectValidationCompleted'));
  assert.ok(eventTypes.includes('ArchitectureViolationDetected'));
});

test('slice close keeps task completed when commit succeeds but pre-push fails', () => {
  const repoDir = setupRepo();
  prepareGovernedSession(repoDir);
  createInProgressTask(repoDir, 'slice-004');

  writeJson(path.join(repoDir, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: 'release/mainline',
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    governanceMode: 'project',
    strictTasksDoc: false,
  });

  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'slice-004.js'), 'export const slice004 = true;\n', 'utf8');

  const closeResult = run(process.execPath, [askBinPath, 'slice', 'close', 'slice-004'], { cwd: repoDir });
  assert.equal(closeResult.status, 1, closeResult.stdout + closeResult.stderr);
  const payload = JSON.parse(closeResult.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'slice-close-pre-push-failed');
  assert.equal(readTaskStatus(repoDir, 'slice-004'), 'completed');
});
