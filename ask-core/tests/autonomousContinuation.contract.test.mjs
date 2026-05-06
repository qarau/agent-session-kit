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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-autonomy-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow('git', ['add', '.'], { cwd: tempRoot });
  runOrThrow('git', ['commit', '-m', 'baseline'], { cwd: tempRoot });
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

test('ask continue --once runs one governed loop and writes resume/metrics artifacts', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const continuation = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'continue',
      '--once',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--allowed-command',
      'node -e "process.exit(0)"',
      '--operation',
      'autonomy-contract-smoke',
    ],
    { cwd: repoDir }
  );
  const payload = JSON.parse(continuation.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.slicesRun, 1);
  assert.equal(payload.validation.status, 'passed');

  const events = readEvents(repoDir);
  const eventTypes = events.map(event => event.type);
  assert.ok(eventTypes.includes('AutonomousLoopStarted'));
  assert.ok(eventTypes.includes('ProjectionHydrated'));
  assert.ok(eventTypes.includes('IntentSelected'));
  assert.ok(eventTypes.includes('SliceCreated'));
  assert.ok(eventTypes.includes('ValidationStarted'));
  assert.ok(eventTypes.includes('ValidationPassed'));
  assert.ok(eventTypes.includes('RuntimeMetricsCaptured'));
  assert.ok(eventTypes.includes('AutonomousLoopCompleted'));

  const resumePacket = JSON.parse(fs.readFileSync(path.join(repoDir, '.ask', 'continuity', 'resume.json'), 'utf8'));
  assert.equal(resumePacket.sessionId, payload.resumePacket.sessionId);
  assert.equal(typeof resumePacket.contextRecoveryCost.estimatedTokens, 'number');

  const metrics = JSON.parse(fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'metrics.json'), 'utf8'));
  assert.equal(metrics.loopsRun >= 1, true);
});

test('ask continue fails when session is not runnable', () => {
  const repoDir = setupRepo();
  const continuation = run(process.execPath, [askBinPath, 'continue', '--once'], { cwd: repoDir });
  assert.equal(continuation.status, 1, continuation.stdout + continuation.stderr);
  const payload = JSON.parse(continuation.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'session-not-runnable');
});

test('ask project-state returns unified runtime state payload', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const stateResult = runOrThrow(process.execPath, [askBinPath, 'project-state'], { cwd: repoDir });
  const payload = JSON.parse(stateResult.stdout);
  assert.equal(typeof payload.sessionId, 'string');
  assert.equal(typeof payload.status, 'string');
  assert.equal(typeof payload.continuityValid, 'boolean');
  assert.equal(typeof payload.nextRecommendedAction, 'string');
});

test('runtime preview and continuity read commands return structured payloads', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(
    process.execPath,
    [
      askBinPath,
      'continue',
      '--once',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--allowed-command',
      'node -e "process.exit(0)"',
      '--operation',
      'autonomy-cli-coverage',
    ],
    { cwd: repoDir }
  );

  const intentPreview = runOrThrow(process.execPath, [askBinPath, 'intent', 'preview'], { cwd: repoDir });
  const intentPayload = JSON.parse(intentPreview.stdout);
  assert.equal(intentPayload.ok, true);
  assert.equal(typeof intentPayload.intent.type, 'string');

  const slicePreview = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'slice',
      'preview',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'slice-preview-contract',
      '--allowed-command',
      'node -e "process.exit(0)"',
    ],
    { cwd: repoDir }
  );
  const slicePayload = JSON.parse(slicePreview.stdout);
  assert.equal(slicePayload.ok, true);
  assert.equal(typeof slicePayload.slice.id, 'string');

  const validateLast = runOrThrow(process.execPath, [askBinPath, 'validate-last'], { cwd: repoDir });
  const validatePayload = JSON.parse(validateLast.stdout);
  assert.equal(validatePayload.ok, true);
  assert.equal(validatePayload.validation.status, 'passed');

  const resumePacket = runOrThrow(process.execPath, [askBinPath, 'resume-packet', 'show'], { cwd: repoDir });
  const resumePayload = JSON.parse(resumePacket.stdout);
  assert.equal(typeof resumePayload.sessionId, 'string');

  const metrics = runOrThrow(process.execPath, [askBinPath, 'metrics', 'show'], { cwd: repoDir });
  const metricsPayload = JSON.parse(metrics.stdout);
  assert.equal(metricsPayload.loopsRun >= 1, true);
});
