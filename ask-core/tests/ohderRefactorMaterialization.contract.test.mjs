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

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-refactor-materialization-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  writeJson(path.join(tempRoot, '.ask', 'runtime', 'architect-status.json'), {
    status: 'passed',
    blocking: false,
    reason: 'architecture guardrails satisfied',
    replayabilityRisk: 'low',
    architectureScore: {
      overallScore: 98,
    },
  });
  writeJson(path.join(tempRoot, '.ask', 'runtime', 'drift-analytics.json'), {
    architecture: {
      entropyTrend: 'increasing',
      couplingTrend: 'stable',
      replayabilityTrend: 'stable',
      driftScore: 0.5,
    },
    behavior: {
      driftScore: 0,
    },
    overall: {
      trend: 'regressing',
      driftScore: 0.25,
    },
    updatedAt: new Date().toISOString(),
  });
  return tempRoot;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readEvents(repoDir) {
  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  if (!fs.existsSync(eventsPath)) {
    return [];
  }
  return fs.readFileSync(eventsPath, 'utf8')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function taskStatus(repoDir, taskId = '') {
  const args = [askBinPath, 'task', 'status'];
  if (taskId) {
    args.push(taskId);
  }
  return JSON.parse(runOrThrow(process.execPath, args, { cwd: repoDir }).stdout);
}

test('ask refactor preview returns recommendation without mutating task state', () => {
  const repoDir = setupRepo();
  const before = Object.keys(taskStatus(repoDir).tasks);

  const result = runOrThrow(process.execPath, [askBinPath, 'refactor', 'preview'], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  const after = Object.keys(taskStatus(repoDir).tasks);

  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'preview');
  assert.equal(payload.recommendation.confidence, 'high');
  assert.match(payload.recommendation.reason, /entropy trend is regressing/i);
  assert.deepEqual(after, before);
  assert.equal(readEvents(repoDir).some(event => event.type === 'RefactorSuggested'), false);
});

test('ask refactor create materializes governed task and emits RefactorSuggested', () => {
  const repoDir = setupRepo();

  const result = runOrThrow(process.execPath, [askBinPath, 'refactor', 'create'], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  const task = taskStatus(repoDir, payload.task.taskId).task;
  const suggestedEvents = readEvents(repoDir).filter(event => event.type === 'RefactorSuggested');

  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'create');
  assert.match(payload.task.taskId, /^ohder-refactor-[a-f0-9]{12}$/u);
  assert.equal(task.status, 'created');
  assert.equal(task.title, payload.recommendation.title);
  assert.match(task.description, /OHDER entropy trend is regressing/i);
  assert.deepEqual(task.acceptanceCriteria, payload.recommendation.acceptanceCriteria);
  assert.equal(task.origin.type, 'ohder-refactor-governance');
  assert.equal(task.origin.recommendationFingerprint, payload.recommendation.fingerprint);
  assert.equal(suggestedEvents.length, 1);
  assert.equal(suggestedEvents[0].payload.recommendationFingerprint, payload.recommendation.fingerprint);
  assert.equal(suggestedEvents[0].payload.taskId, payload.task.taskId);
});

test('ask refactor create is idempotent for the same recommendation fingerprint', () => {
  const repoDir = setupRepo();

  const first = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'create'], { cwd: repoDir }).stdout);
  const second = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'create'], { cwd: repoDir }).stdout);
  const suggestedEvents = readEvents(repoDir).filter(event => event.type === 'RefactorSuggested');

  assert.equal(second.ok, true);
  assert.equal(second.created, false);
  assert.equal(second.task.taskId, first.task.taskId);
  assert.equal(second.recommendation.fingerprint, first.recommendation.fingerprint);
  assert.equal(suggestedEvents.length, 1);
});

test('low confidence refactor recommendations are suggest-only', () => {
  const repoDir = setupRepo();
  writeJson(path.join(repoDir, '.ask', 'runtime', 'architect-status.json'), {
    status: 'warning',
    blocking: false,
    reason: 'minor architecture drift detected',
    entropyDelta: 1,
    couplingDelta: 0,
    replayabilityRisk: 'low',
    architectureScore: {
      overallScore: 97,
    },
  });
  writeJson(path.join(repoDir, '.ask', 'runtime', 'drift-analytics.json'), {
    architecture: {
      entropyTrend: 'stable',
      couplingTrend: 'stable',
      replayabilityTrend: 'stable',
      driftScore: 0,
    },
    behavior: {
      driftScore: 0,
    },
    overall: {
      trend: 'stable',
      driftScore: 0,
    },
  });

  const payload = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'create'], { cwd: repoDir }).stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.created, false);
  assert.equal(payload.recommendation.confidence, 'low');
  assert.equal(payload.decision, 'suggest-only');
  assert.equal(payload.task, null);
});

test('medium confidence refactor recommendations create approval-required tasks', () => {
  const repoDir = setupRepo();
  writeJson(path.join(repoDir, '.ask', 'runtime', 'architect-status.json'), {
    status: 'warning',
    blocking: false,
    reason: 'architecture score under target',
    replayabilityRisk: 'low',
    architectureScore: {
      overallScore: 65,
    },
  });
  writeJson(path.join(repoDir, '.ask', 'runtime', 'drift-analytics.json'), {
    architecture: {
      entropyTrend: 'stable',
      couplingTrend: 'stable',
      replayabilityTrend: 'stable',
      driftScore: 0,
    },
    behavior: {
      driftScore: 0,
    },
    overall: {
      trend: 'stable',
      driftScore: 0,
    },
  });

  const payload = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'create'], { cwd: repoDir }).stdout);
  const task = taskStatus(repoDir, payload.task.taskId).task;

  assert.equal(payload.ok, true);
  assert.equal(payload.recommendation.confidence, 'medium');
  assert.equal(task.refactorGovernance.approvalRequired, true);
  assert.equal(task.refactorGovernance.approvalStatus, 'pending');
});

test('refactor approve and reject emit replayable governance events', () => {
  const approvedRepo = setupRepo();
  writeJson(path.join(approvedRepo, '.ask', 'runtime', 'architect-status.json'), {
    status: 'warning',
    blocking: false,
    reason: 'architecture score under target',
    replayabilityRisk: 'low',
    architectureScore: {
      overallScore: 65,
    },
  });
  writeJson(path.join(approvedRepo, '.ask', 'runtime', 'drift-analytics.json'), {
    overall: {
      trend: 'stable',
      driftScore: 0,
    },
  });
  const created = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'create'], { cwd: approvedRepo }).stdout);
  const approved = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'approve', created.task.taskId, '--approved-by', 'architect'], { cwd: approvedRepo }).stdout);
  const approvedTask = taskStatus(approvedRepo, created.task.taskId).task;
  const approvedEvents = readEvents(approvedRepo).filter(event => event.type === 'RefactorApproved');

  assert.equal(approved.ok, true);
  assert.equal(approvedTask.refactorGovernance.approvalStatus, 'approved');
  assert.equal(approvedEvents.length, 1);
  assert.equal(approvedEvents[0].payload.approvedBy, 'architect');

  const rejectedRepo = setupRepo();
  writeJson(path.join(rejectedRepo, '.ask', 'runtime', 'architect-status.json'), {
    status: 'warning',
    blocking: false,
    reason: 'architecture score under target',
    replayabilityRisk: 'low',
    architectureScore: {
      overallScore: 65,
    },
  });
  writeJson(path.join(rejectedRepo, '.ask', 'runtime', 'drift-analytics.json'), {
    overall: {
      trend: 'stable',
      driftScore: 0,
    },
  });
  const rejectedCreated = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'create'], { cwd: rejectedRepo }).stdout);
  const rejected = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'reject', rejectedCreated.task.taskId, '--reason', 'too risky'], { cwd: rejectedRepo }).stdout);
  const rejectedTask = taskStatus(rejectedRepo, rejectedCreated.task.taskId).task;
  const rejectedEvents = readEvents(rejectedRepo).filter(event => event.type === 'RefactorRejected');

  assert.equal(rejected.ok, true);
  assert.equal(rejectedTask.status, 'blocked');
  assert.equal(rejectedTask.refactorGovernance.approvalStatus, 'rejected');
  assert.equal(rejectedEvents.length, 1);
  assert.equal(rejectedEvents[0].payload.reason, 'too risky');
});

test('automatic high-confidence creation is controlled by policy', () => {
  const disabledRepo = setupRepo();
  fs.appendFileSync(path.join(disabledRepo, '.ask', 'policy', 'runtime-policy.yaml'), '\nrefactor_materialization:\n  auto_materialize_high_confidence: false\n');
  const disabled = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'create', '--auto'], { cwd: disabledRepo }).stdout);
  assert.equal(disabled.ok, true);
  assert.equal(disabled.created, false);
  assert.equal(disabled.decision, 'auto-disabled');

  const enabledRepo = setupRepo();
  fs.appendFileSync(path.join(enabledRepo, '.ask', 'policy', 'runtime-policy.yaml'), '\nrefactor_materialization:\n  auto_materialize_high_confidence: true\n');
  const enabled = JSON.parse(runOrThrow(process.execPath, [askBinPath, 'refactor', 'create', '--auto'], { cwd: enabledRepo }).stdout);
  assert.equal(enabled.ok, true);
  assert.equal(enabled.created, true);
  assert.equal(enabled.recommendation.confidence, 'high');
});
