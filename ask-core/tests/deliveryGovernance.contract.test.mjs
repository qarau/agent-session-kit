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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-delivery-governance-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Delivery target'], { cwd: repoDir });
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

test('feature create link-task status works deterministically', () => {
  const repoDir = setupRepo();

  const created = runOrThrow(process.execPath, [askBinPath, 'feature', 'create', 'feature-1', '--title', 'Feature One'], {
    cwd: repoDir,
  });
  const linked = runOrThrow(process.execPath, [askBinPath, 'feature', 'link-task', 'feature-1', '--task', 'task-1'], {
    cwd: repoDir,
  });
  const status = runOrThrow(process.execPath, [askBinPath, 'feature', 'status', 'feature-1'], { cwd: repoDir });

  assert.equal(JSON.parse(created.stdout).ok, true);
  assert.equal(JSON.parse(linked.stdout).ok, true);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, true);
  assert.deepEqual(statusPayload.feature.tasks, ['task-1']);

  const features = readSnapshot(repoDir, 'features.json');
  assert.deepEqual(features.features['feature-1'].tasks, ['task-1']);

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('FeatureCreated'));
  assert.ok(eventTypes.includes('FeatureTaskLinked'));
});

test('release create link-feature status works deterministically', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'feature', 'create', 'feature-1', '--title', 'Feature One'], { cwd: repoDir });

  const created = runOrThrow(process.execPath, [askBinPath, 'release', 'create', 'train-1', '--title', 'Train One'], {
    cwd: repoDir,
  });
  const linked = runOrThrow(process.execPath, [askBinPath, 'release', 'link-feature', 'train-1', '--feature', 'feature-1'], {
    cwd: repoDir,
  });
  const status = runOrThrow(process.execPath, [askBinPath, 'release', 'status', 'train-1'], { cwd: repoDir });

  assert.equal(JSON.parse(created.stdout).ok, true);
  assert.equal(JSON.parse(linked.stdout).ok, true);
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, true);
  assert.deepEqual(statusPayload.release.features, ['feature-1']);

  const releases = readSnapshot(repoDir, 'release-trains.json');
  assert.deepEqual(releases.trains['train-1'].features, ['feature-1']);

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('ReleaseTrainCreated'));
  assert.ok(eventTypes.includes('ReleaseFeatureLinked'));
});

test('promote require pass advance enforces gate invariants', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'feature', 'create', 'feature-1', '--title', 'Feature One'], { cwd: repoDir });

  const required = runOrThrow(process.execPath, [askBinPath, 'promote', 'require', 'feature-1', '--gate', 'ci'], {
    cwd: repoDir,
  });
  assert.equal(JSON.parse(required.stdout).ok, true);

  const blockedAdvance = run(process.execPath, [askBinPath, 'promote', 'advance', 'feature-1', '--stage', 'production'], {
    cwd: repoDir,
  });
  assert.equal(blockedAdvance.status, 1, blockedAdvance.stdout + blockedAdvance.stderr);
  const blockedPayload = JSON.parse(blockedAdvance.stdout);
  assert.equal(blockedPayload.ok, false);
  assert.equal(blockedPayload.code, 'promotion-gates-unmet');

  const passed = runOrThrow(process.execPath, [askBinPath, 'promote', 'pass', 'feature-1', '--gate', 'ci'], { cwd: repoDir });
  assert.equal(JSON.parse(passed.stdout).ok, true);

  const advanced = runOrThrow(process.execPath, [askBinPath, 'promote', 'advance', 'feature-1', '--stage', 'production'], {
    cwd: repoDir,
  });
  const advancedPayload = JSON.parse(advanced.stdout);
  assert.equal(advancedPayload.ok, true);
  assert.equal(advancedPayload.promotion.currentStage, 'production');

  const promotion = readSnapshot(repoDir, 'promotion-gates.json');
  assert.equal(promotion.features['feature-1'].gates.ci.status, 'passed');
  assert.equal(promotion.features['feature-1'].currentStage, 'production');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('PromotionGateRequired'));
  assert.ok(eventTypes.includes('PromotionGatePassed'));
  assert.ok(eventTypes.includes('PromotionAdvanced'));
});

test('rollout start phase status and rollback trigger status', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'feature', 'create', 'feature-1', '--title', 'Feature One'], { cwd: repoDir });

  const started = runOrThrow(process.execPath, [askBinPath, 'rollout', 'start', 'feature-1', '--phase', 'canary'], {
    cwd: repoDir,
  });
  assert.equal(JSON.parse(started.stdout).ok, true);

  const phased = runOrThrow(process.execPath, [askBinPath, 'rollout', 'phase', 'feature-1', '--phase', 'full'], { cwd: repoDir });
  assert.equal(JSON.parse(phased.stdout).ok, true);

  const rolledBack = runOrThrow(process.execPath, [askBinPath, 'rollback', 'trigger', 'feature-1', '--reason', 'incident'], {
    cwd: repoDir,
  });
  const rollbackPayload = JSON.parse(rolledBack.stdout);
  assert.equal(rollbackPayload.ok, true);

  const status = runOrThrow(process.execPath, [askBinPath, 'rollout', 'status', 'feature-1'], { cwd: repoDir });
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, true);
  assert.equal(statusPayload.rollout.status, 'rolled-back');
  assert.equal(statusPayload.rollout.currentPhase, 'full');
  assert.equal(statusPayload.rollout.rollback.reason, 'incident');

  const rollout = readSnapshot(repoDir, 'rollout.json');
  assert.equal(rollout.features['feature-1'].status, 'rolled-back');
  assert.equal(rollout.features['feature-1'].rollback.reason, 'incident');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('RolloutStarted'));
  assert.ok(eventTypes.includes('RolloutPhaseSet'));
  assert.ok(eventTypes.includes('RollbackTriggered'));
});
