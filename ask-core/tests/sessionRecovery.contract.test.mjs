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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-recovery-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  return tempRoot;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readHistory(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

test('recovery finalizes snapshot when pending transition already exists in history', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const sessionsDir = path.join(repoDir, '.ask', 'sessions');
  const snapshotPath = path.join(sessionsDir, 'active-session.json');
  const historyPath = path.join(sessionsDir, 'history.ndjson');
  const pendingPath = path.join(sessionsDir, 'pending-transition.json');
  const snapshot = readJson(snapshotPath);
  const history = readHistory(historyPath);
  const lastEvent = history.at(-1);
  const pendingEvent = {
    ...lastEvent,
    from: snapshot.status,
    to: 'blocked',
    at: '2026-03-12T00:01:00.000Z',
    reason: 'waiting for dependency',
    sourceCommand: 'session block',
  };

  fs.appendFileSync(historyPath, `${JSON.stringify(pendingEvent)}\n`, 'utf8');
  fs.writeFileSync(pendingPath, JSON.stringify(pendingEvent, null, 2), 'utf8');

  runOrThrow(process.execPath, [askBinPath, 'session', 'status'], { cwd: repoDir });

  const recoveredSnapshot = readJson(snapshotPath);
  assert.equal(recoveredSnapshot.status, 'blocked');
  assert.equal(fs.existsSync(pendingPath), false);
});

test('legacy active session without history bootstraps synthetic lineage before new transition', () => {
  const repoDir = setupRepo();
  const sessionsDir = path.join(repoDir, '.ask', 'sessions');
  const snapshotPath = path.join(sessionsDir, 'active-session.json');
  const historyPath = path.join(sessionsDir, 'history.ndjson');

  fs.writeFileSync(
    snapshotPath,
    JSON.stringify(
      {
        sessionId: 'sess_legacy',
        status: 'active',
        branch: 'ask-runtime',
        worktree: repoDir,
        repoRoot: repoDir,
        taskId: '',
        actorType: 'human',
        actorId: 'local',
        startedAt: '2026-03-12T00:00:00.000Z',
        lastActiveAt: '2026-03-12T00:00:00.000Z',
      },
      null,
      2
    ),
    'utf8'
  );
  fs.writeFileSync(historyPath, '', 'utf8');

  runOrThrow(process.execPath, [askBinPath, 'session', 'pause', '--reason', 'legacy snapshot migration'], {
    cwd: repoDir,
  });

  const history = readHistory(historyPath);
  assert.deepEqual(
    history.slice(0, 2).map(event => event.to),
    ['active', 'paused']
  );
  assert.equal(history[0].from, 'created');
});
