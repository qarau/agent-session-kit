import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { SequenceStore } from '../src/runtime/SequenceStore.js';
import { EventLedger } from '../src/runtime/EventLedger.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-event-ledger-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  return tempRoot;
}

test('ask init scaffolds runtime event files and sequence state', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  const sequencePath = path.join(repoDir, '.ask', 'runtime', 'sequence.json');

  assert.equal(fs.existsSync(eventsPath), true, 'events.ndjson should be scaffolded');
  assert.equal(fs.existsSync(sequencePath), true, 'sequence.json should be scaffolded');

  const sequence = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
  assert.equal(sequence.nextSeq, 1);
});

test('ask init is non-destructive by default and preserves sequence state', async () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const ledger = new EventLedger(repoDir);
  await ledger.append({
    type: 'SessionStarted',
    sessionId: 'sess_001',
    actor: 'local',
    payload: { goal: 'non-destructive-init' },
  });
  await ledger.append({
    type: 'TaskCreated',
    sessionId: 'sess_001',
    taskId: 'task-1',
    actor: 'local',
    payload: { title: 'Preserve sequence' },
  });

  const sequencePath = path.join(repoDir, '.ask', 'runtime', 'sequence.json');
  const before = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
  assert.equal(before.nextSeq, 3);

  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const after = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
  assert.equal(after.nextSeq, 3, 'default init should not reset sequence state');

  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  const lines = fs
    .readFileSync(eventsPath, 'utf8')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);
  assert.equal(lines.length, 2, 'default init should not truncate runtime event log');
});

test('ask init auto-heals duplicate and non-monotonic sequence values', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const runtimeDir = path.join(repoDir, '.ask', 'runtime');
  const eventsPath = path.join(runtimeDir, 'events.ndjson');
  const sequencePath = path.join(runtimeDir, 'sequence.json');
  const now = '2026-03-14T00:00:00.000Z';

  const corrupted = [
    {
      seq: 2,
      type: 'TaskCreated',
      ts: now,
      sessionId: 'sess_001',
      taskId: 'task-1',
      actor: 'local',
      payload: { title: 'first' },
      meta: {},
    },
    {
      seq: 2,
      type: 'TaskStarted',
      ts: now,
      sessionId: 'sess_001',
      taskId: 'task-1',
      actor: 'local',
      payload: {},
      meta: {},
    },
    {
      seq: 1,
      type: 'TaskCompleted',
      ts: now,
      sessionId: 'sess_001',
      taskId: 'task-1',
      actor: 'local',
      payload: {},
      meta: {},
    },
  ];
  fs.writeFileSync(eventsPath, `${corrupted.map(record => JSON.stringify(record)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(sequencePath, `${JSON.stringify({ nextSeq: 2 }, null, 2)}\n`, 'utf8');

  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const repaired = fs
    .readFileSync(eventsPath, 'utf8')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));

  assert.deepEqual(
    repaired.map(record => record.type),
    ['TaskCreated', 'TaskStarted', 'TaskCompleted'],
    'repair should preserve runtime log line order'
  );
  assert.deepEqual(
    repaired.map(record => record.seq),
    [1, 2, 3],
    'repair should rewrite runtime log to strict 1..N sequence'
  );

  const sequence = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
  assert.equal(sequence.nextSeq, 4);

  const runtimeFiles = fs.readdirSync(runtimeDir);
  const backupFiles = runtimeFiles.filter(file => /^events\.backup\..+\.ndjson$/u.test(file));
  assert.equal(backupFiles.length > 0, true, 'repair should create an event log backup before resequencing');

  const reportPath = path.join(runtimeDir, 'sequence-repair-report.json');
  assert.equal(fs.existsSync(reportPath), true, 'repair should write a repair report');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.repaired, true);
  assert.equal(report.mode, 'resequence');
});

test('ask init --reset-runtime explicitly clears runtime ledger and sequence state', async () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const ledger = new EventLedger(repoDir);
  await ledger.append({
    type: 'SessionStarted',
    sessionId: 'sess_001',
    actor: 'local',
    payload: { goal: 'reset-runtime' },
  });
  await ledger.append({
    type: 'TaskCreated',
    sessionId: 'sess_001',
    taskId: 'task-1',
    actor: 'local',
    payload: { title: 'wipe me' },
  });

  runOrThrow(process.execPath, [askBinPath, 'init', '--reset-runtime'], { cwd: repoDir });

  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  const eventsRaw = fs.readFileSync(eventsPath, 'utf8').trim();
  assert.equal(eventsRaw, '');

  const sequencePath = path.join(repoDir, '.ask', 'runtime', 'sequence.json');
  const sequence = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
  assert.equal(sequence.nextSeq, 1);
});

test('SequenceStore next increments deterministically', async () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const sequences = new SequenceStore(repoDir);
  const first = await sequences.next();
  const second = await sequences.next();

  assert.equal(first, 1);
  assert.equal(second, 2);

  const sequencePath = path.join(repoDir, '.ask', 'runtime', 'sequence.json');
  const sequence = JSON.parse(fs.readFileSync(sequencePath, 'utf8'));
  assert.equal(sequence.nextSeq, 3);
});

test('EventLedger append writes ordered envelope records', async () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const ledger = new EventLedger(repoDir);
  const first = await ledger.append({
    type: 'SessionStarted',
    sessionId: 'sess_001',
    actor: 'local',
    payload: { goal: 'event-ledger-foundation' },
  });
  const second = await ledger.append({
    type: 'TaskCreated',
    sessionId: 'sess_001',
    taskId: 'contracts',
    actor: 'local',
    payload: { title: 'Add contracts' },
  });

  assert.equal(first.seq, 1);
  assert.equal(second.seq, 2);
  assert.match(first.ts, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(second.ts, /^\d{4}-\d{2}-\d{2}T/);

  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  const lines = fs
    .readFileSync(eventsPath, 'utf8')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);

  assert.equal(lines.length, 2);
  const records = lines.map(line => JSON.parse(line));
  assert.deepEqual(
    records.map(record => record.seq),
    [1, 2]
  );
  assert.equal(records[1].taskId, 'contracts');
});
