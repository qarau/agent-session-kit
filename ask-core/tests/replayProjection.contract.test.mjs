import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { RuntimeProjectionEngine } from '../src/runtime/RuntimeProjectionEngine.js';

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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-replay-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  return tempRoot;
}

function writeEvents(repoDir, events) {
  const runtimeDir = path.join(repoDir, '.ask', 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  const lines = events.map(event => JSON.stringify(event)).join('\n');
  fs.writeFileSync(path.join(runtimeDir, 'events.ndjson'), `${lines}\n`, 'utf8');
}

test('replay projects events by seq and writes snapshots', async () => {
  const repoDir = setupRepo();
  writeEvents(repoDir, [
    {
      seq: 2,
      type: 'SessionClosed',
      ts: '2026-03-14T00:00:01.000Z',
      sessionId: 'sess_001',
      actor: 'local',
      payload: { reason: 'done' },
      meta: {},
    },
    {
      seq: 1,
      type: 'SessionStarted',
      ts: '2026-03-14T00:00:00.000Z',
      sessionId: 'sess_001',
      actor: 'local',
      payload: { goal: 'replay-contract' },
      meta: {},
    },
    {
      seq: 3,
      type: 'TaskCreated',
      ts: '2026-03-14T00:00:02.000Z',
      sessionId: 'sess_001',
      taskId: 'task-1',
      actor: 'local',
      payload: { title: 'Draft runtime projector' },
      meta: {},
    },
    {
      seq: 4,
      type: 'VerificationPassed',
      ts: '2026-03-14T00:00:03.000Z',
      sessionId: 'sess_001',
      taskId: 'task-1',
      actor: 'local',
      payload: { summary: 'green' },
      meta: {},
    },
  ]);

  const engine = new RuntimeProjectionEngine(repoDir);
  const summary = await engine.replay();

  assert.equal(summary.eventsProcessed, 4);
  assert.equal(summary.lastSeq, 4);

  const sessionSnapshot = JSON.parse(
    fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'snapshots', 'session.json'), 'utf8')
  );
  const taskSnapshot = JSON.parse(
    fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'snapshots', 'tasks.json'), 'utf8')
  );
  const verificationSnapshot = JSON.parse(
    fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'snapshots', 'verification.json'), 'utf8')
  );

  assert.equal(sessionSnapshot.sessionId, 'sess_001');
  assert.equal(sessionSnapshot.status, 'closed');
  assert.equal(sessionSnapshot.lastEventSeq, 2);
  assert.equal(taskSnapshot.tasks['task-1'].status, 'created');
  assert.equal(verificationSnapshot.tasks['task-1'].status, 'passed');
});

test('ask replay runs successfully and prints summary', () => {
  const repoDir = setupRepo();
  writeEvents(repoDir, [
    {
      seq: 1,
      type: 'SessionStarted',
      ts: '2026-03-14T00:00:00.000Z',
      sessionId: 'sess_002',
      actor: 'local',
      payload: { goal: 'cli' },
      meta: {},
    },
  ]);

  const result = run(process.execPath, [askBinPath, 'replay'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /eventsProcessed/i);
  assert.match(result.stdout, /"lastSeq":\s*1/i);
});
