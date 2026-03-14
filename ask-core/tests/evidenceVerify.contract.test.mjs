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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-evidence-verify-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Verification runtime'], {
    cwd: tempRoot,
  });
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

function readVerificationSnapshot(repoDir) {
  const filePath = path.join(repoDir, '.ask', 'runtime', 'snapshots', 'verification.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('evidence attach appends event and updates verification projection evidence count', () => {
  const repoDir = setupRepo();

  const attached = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'evidence',
      'attach',
      'task-1',
      '--kind',
      'test-output',
      '--path',
      'artifacts/test.log',
      '--summary',
      'first evidence',
    ],
    { cwd: repoDir }
  );

  const payload = JSON.parse(attached.stdout);
  assert.equal(payload.ok, true);

  const snapshot = readVerificationSnapshot(repoDir);
  assert.equal(snapshot.tasks['task-1'].evidenceCount, 1);

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('EvidenceAttached'));
});

test('verify pass and fail append events and update verification status', () => {
  const repoDir = setupRepo();

  const passed = runOrThrow(process.execPath, [askBinPath, 'verify', 'pass', 'task-1', '--summary', 'green'], {
    cwd: repoDir,
  });
  const passPayload = JSON.parse(passed.stdout);
  assert.equal(passPayload.ok, true);

  let snapshot = readVerificationSnapshot(repoDir);
  assert.equal(snapshot.tasks['task-1'].status, 'passed');
  assert.equal(snapshot.tasks['task-1'].summary, 'green');

  const failed = runOrThrow(process.execPath, [askBinPath, 'verify', 'fail', 'task-1', '--summary', 'regression'], {
    cwd: repoDir,
  });
  const failPayload = JSON.parse(failed.stdout);
  assert.equal(failPayload.ok, true);

  snapshot = readVerificationSnapshot(repoDir);
  assert.equal(snapshot.tasks['task-1'].status, 'failed');
  assert.equal(snapshot.tasks['task-1'].summary, 'regression');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('VerificationPassed'));
  assert.ok(eventTypes.includes('VerificationFailed'));
});
