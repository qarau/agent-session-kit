import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { RuntimeSnapshotStore } from '../src/runtime/RuntimeSnapshotStore.js';

async function setupRepo() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'ask-snapshot-store-'));
}

test('RuntimeSnapshotStore preserves explicit session fallback when snapshot is missing', async () => {
  const repoDir = await setupRepo();
  const snapshots = new RuntimeSnapshotStore(repoDir);
  const fallback = {
    sessionId: 'sess_fallback',
    status: 'active',
    branch: 'snapshot-tests',
  };

  const session = await snapshots.readSession(fallback);

  assert.deepEqual(session, fallback);
});

test('RuntimeSnapshotStore returns task-indexed defaults for representative snapshots', async () => {
  const repoDir = await setupRepo();
  const snapshots = new RuntimeSnapshotStore(repoDir);

  assert.deepEqual(await snapshots.readVerification(), { tasks: {} });
  assert.deepEqual(await snapshots.readWorkflow(), { tasks: {} });
  assert.deepEqual(await snapshots.readFreshness(), { tasks: {} });
});

test('RuntimeSnapshotStore normalizes loose projection state while preserving unknown fields', async () => {
  const repoDir = await setupRepo();
  const runtimeDir = path.join(repoDir, '.ask', 'runtime');
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.writeFile(
    path.join(runtimeDir, 'projection-state.json'),
    JSON.stringify({
      lastAppliedSeq: 'not-a-number',
      requiresReplay: 'yes',
      reason: 42,
      updatedAt: '',
      extraLegacyField: 'preserved',
    }),
    'utf8',
  );

  const cursor = await new RuntimeSnapshotStore(repoDir).readProjectionState();

  assert.equal(cursor.lastAppliedSeq, 0);
  assert.equal(cursor.requiresReplay, false);
  assert.equal(cursor.reason, '');
  assert.match(cursor.updatedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.equal(cursor.extraLegacyField, 'preserved');
});

test('RuntimeSnapshotStore writeProjectionState normalizes missing and invalid fields', async () => {
  const repoDir = await setupRepo();
  const snapshots = new RuntimeSnapshotStore(repoDir);

  const cursor = await snapshots.writeProjectionState({
    lastAppliedSeq: -4,
    requiresReplay: true,
    reason: 7,
  });

  assert.equal(cursor.lastAppliedSeq, 0);
  assert.equal(cursor.requiresReplay, true);
  assert.equal(cursor.reason, '');
  assert.match(cursor.updatedAt, /^\d{4}-\d{2}-\d{2}T/u);
});

test('RuntimeSnapshotStore replay proof defaults and merges with generated timestamp', async () => {
  const repoDir = await setupRepo();
  const snapshots = new RuntimeSnapshotStore(repoDir);

  const fallback = await snapshots.readReplayProof();
  assert.equal(fallback.schemaVersion, 1);
  assert.equal(fallback.mode, 'none');
  assert.equal(fallback.eventCount, 0);
  assert.equal(fallback.sequenceIntegrity.contiguous, true);

  const first = await snapshots.writeReplayProof({
    mode: 'full-replay',
    eventCount: 3,
    lastSeq: 3,
    generatedAt: '2026-05-10T00:00:00.000Z',
  });
  assert.equal(first.mode, 'full-replay');
  assert.equal(first.eventCount, 3);
  assert.equal(first.generatedAt, '2026-05-10T00:00:00.000Z');

  const second = await snapshots.writeReplayProof({
    mode: 'incremental',
    projectionCursor: 3,
  });
  assert.equal(second.mode, 'incremental');
  assert.equal(second.eventCount, 3);
  assert.equal(second.lastSeq, 3);
  assert.equal(second.projectionCursor, 3);
  assert.match(second.generatedAt, /^\d{4}-\d{2}-\d{2}T/u);
});
