import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { EventLedger } from '../src/runtime/EventLedger.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      `status=${String(result.status)}`,
      result.stdout ?? '',
      result.stderr ?? '',
    ].join('\n'));
  }
  return result;
}

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-event-ledger-guards-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  return repoDir;
}

test('EventLedger append preserves payload and metadata on returned and persisted events', async () => {
  const repoDir = setupRepo();
  const ledger = new EventLedger(repoDir);

  const event = await ledger.append({
    type: 'TaskCreated',
    sessionId: 'sess-ledger-guards',
    taskId: 'task-ledger-guards',
    actor: 'local',
    payload: { title: 'Guard EventLedger metadata' },
    meta: { source: 'runtime-guard-test', schemaVersion: 1 },
  });

  assert.deepEqual(event.payload, { title: 'Guard EventLedger metadata' });
  assert.deepEqual(event.meta, { source: 'runtime-guard-test', schemaVersion: 1 });

  const [persisted] = await ledger.readAll();
  assert.deepEqual(persisted.payload, event.payload);
  assert.deepEqual(persisted.meta, event.meta);
});

test('EventLedger readAll returns events sorted by sequence', async () => {
  const repoDir = setupRepo();
  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  const now = '2026-05-10T00:00:00.000Z';
  const records = [
    { seq: 3, type: 'TaskCompleted', ts: now, sessionId: 'sess-order', actor: 'local', payload: {}, meta: {} },
    { seq: 1, type: 'TaskCreated', ts: now, sessionId: 'sess-order', actor: 'local', payload: {}, meta: {} },
    { seq: 2, type: 'TaskStarted', ts: now, sessionId: 'sess-order', actor: 'local', payload: {}, meta: {} },
  ];
  fs.writeFileSync(eventsPath, `${records.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8');

  const sorted = await new EventLedger(repoDir).readAll();

  assert.deepEqual(sorted.map(event => event.seq), [1, 2, 3]);
});

test('EventLedger readAll throws on malformed NDJSON lines', async () => {
  const repoDir = setupRepo();
  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  fs.writeFileSync(eventsPath, '{"seq":1,"type":"TaskCreated"}\nnot-json\n', 'utf8');

  await assert.rejects(
    () => new EventLedger(repoDir).readAll(),
    SyntaxError
  );
});
