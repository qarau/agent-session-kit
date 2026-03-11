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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-lifecycle-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  return tempRoot;
}

function readHistory(historyPath) {
  const lines = fs
    .readFileSync(historyPath, 'utf8')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

test('session lifecycle transitions append history and update snapshot', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'pause', '--reason', 'waiting on dependency'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'resume', '--reason', 'dependency resolved'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'block', '--reason', 'test fixture unstable'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'close', '--reason', 'phase complete'], { cwd: repoDir });

  const snapshotPath = path.join(repoDir, '.ask', 'sessions', 'active-session.json');
  const historyPath = path.join(repoDir, '.ask', 'sessions', 'history.ndjson');

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const events = readHistory(historyPath);

  assert.equal(snapshot.status, 'closed');
  assert.deepEqual(
    events.map(event => event.to),
    ['active', 'paused', 'resumed', 'blocked', 'closed']
  );
  assert.equal(events[0].from, 'created');
});

test('invalid transition returns deterministic JSON error with exit 1', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'close', '--reason', 'done'], { cwd: repoDir });

  const result = run(process.execPath, [askBinPath, 'session', 'pause', '--reason', 'too late'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'invalid-transition');
  assert.equal(payload.from, 'closed');
  assert.equal(payload.to, 'paused');
  assert.ok(Array.isArray(payload.allowed));
});

test('pause resume block and close require --reason', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  for (const subcommand of ['pause', 'resume', 'block', 'close']) {
    const result = run(process.execPath, [askBinPath, 'session', subcommand], { cwd: repoDir });
    assert.equal(result.status, 1, `expected ${subcommand} to fail without --reason`);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.code, 'missing-reason');
    assert.equal(payload.command, subcommand);
  }
});
