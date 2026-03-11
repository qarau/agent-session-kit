import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { FileStore } from '../src/fs/FileStore.js';

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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-storage-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  return tempRoot;
}

test('ask init scaffolds session history file and leaves pending marker absent', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });

  const historyPath = path.join(repoDir, '.ask', 'sessions', 'history.ndjson');
  const pendingPath = path.join(repoDir, '.ask', 'sessions', 'pending-transition.json');

  assert.equal(fs.existsSync(historyPath), true, 'history.ndjson should be scaffolded');
  assert.equal(fs.existsSync(pendingPath), false, 'pending marker should not be created during init');
});

test('FileStore appendNdjson and readNdjson preserve event order', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-store-order-'));
  const filePath = path.join(tempRoot, 'history.ndjson');
  const store = new FileStore();

  await store.appendNdjson(filePath, { at: '2026-03-12T00:00:00.000Z', to: 'active' });
  await store.appendNdjson(filePath, { at: '2026-03-12T00:01:00.000Z', to: 'paused' });

  const events = await store.readNdjson(filePath);
  assert.deepEqual(
    events.map(event => event.to),
    ['active', 'paused']
  );
});
