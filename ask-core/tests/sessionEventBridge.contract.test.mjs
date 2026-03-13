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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-session-bridge-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
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

test('session transitions append event-first records and replay snapshots', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'pause', '--reason', 'handoff prep'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'resume', '--reason', 'resume after handoff'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'close', '--reason', 'phase complete'], { cwd: repoDir });

  const events = readEvents(repoDir);
  const types = events.map(event => event.type);
  assert.ok(types.includes('SessionStarted'));
  assert.ok(types.includes('SessionResumed'));
  assert.ok(types.includes('SessionClosed'));

  const sessionSnapshotPath = path.join(repoDir, '.ask', 'runtime', 'snapshots', 'session.json');
  const sessionSnapshot = JSON.parse(fs.readFileSync(sessionSnapshotPath, 'utf8'));
  assert.equal(sessionSnapshot.status, 'closed');

  const activeSessionPath = path.join(repoDir, '.ask', 'sessions', 'active-session.json');
  assert.equal(fs.existsSync(activeSessionPath), true);
  const activeSession = JSON.parse(fs.readFileSync(activeSessionPath, 'utf8'));
  assert.equal(activeSession.status, 'closed');
});

test('handoff create emits SessionHandoffGenerated event', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  runOrThrow(process.execPath, [askBinPath, 'handoff', 'create'], { cwd: repoDir });

  const events = readEvents(repoDir);
  assert.ok(events.some(event => event.type === 'SessionHandoffGenerated'));

  const handoffPath = path.join(repoDir, '.ask', 'handoffs', 'latest-handoff.md');
  assert.equal(fs.existsSync(handoffPath), true);
});

test('context verify emits WorktreeVerified and preserves work-context snapshot', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });

  const events = readEvents(repoDir);
  assert.ok(events.some(event => event.type === 'WorktreeVerified'));

  const contextPath = path.join(repoDir, '.ask', 'state', 'work-context.json');
  assert.equal(fs.existsSync(contextPath), true);
  const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
  assert.equal(context.branch, 'ask-runtime');
});
