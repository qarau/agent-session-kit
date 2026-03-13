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
