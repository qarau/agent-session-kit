import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { OhderEventOnlySyncAnalyzerEngine } from '../src/core/OhderEventOnlySyncAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-event-sync-'));
  await new Scaffolder(repoDir).init();
  writeFile(
    repoDir,
    'ask-core/src/runtime/EventLedger.js',
    "export async function appendEvent(store, paths, event) { await store.appendNdjson(paths.runtimeEvents(), event); }\n"
  );
  writeFile(
    repoDir,
    'ask-core/src/core/DirectCloudStateSync.js',
    "export async function sync(db, state) { await db.collection('tasks').doc('current').set(state, { merge: false }); }\n"
  );
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-event-sync',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-event-sync',
      execution: {
        operation: 'event-only-sync-check',
      },
    },
    execution: {
      ok: true,
      exitCode: 0,
      status: 'completed',
      touchedFiles,
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy: {
      architect: {
        enabled: true,
        block_on_violation: true,
        max_entropy_delta: 3,
        max_coupling_delta: 3,
        require_replayability: true,
      },
      ohder: {
        mode: 'strict',
      },
    },
  };
}

test('event-only sync analyzer allows approved event authority writes', async () => {
  const repoDir = await setupRepo();
  const result = new OhderEventOnlySyncAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/runtime/EventLedger.js'],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.eventOnlySyncValid, true);
  assert.deepEqual(result.violations, []);
});

test('event-only sync analyzer reports direct non-event sync mutation', async () => {
  const repoDir = await setupRepo();
  const result = new OhderEventOnlySyncAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/core/DirectCloudStateSync.js'],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.eventOnlySyncValid, false);
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0].reason, /bypasses event ledger/u);
});

test('architect runtime maps direct sync mutation to event-only hard-law violation', async () => {
  const repoDir = await setupRepo();
  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment([
    'ask-core/src/core/DirectCloudStateSync.js',
  ]));

  const syncFact = status.semanticFacts.find(item => item.metric === 'event_only_sync');

  assert.equal(status.ohderFacts.event_only_sync, 'invalid');
  assert.equal(status.blocking, true);
  assert.ok(status.lawViolations.find(item => item.id === 'ohder-event-only-sync'));
  assert.equal(syncFact.value, 'invalid');
  assert.equal(syncFact.confidence, 'high');
});
