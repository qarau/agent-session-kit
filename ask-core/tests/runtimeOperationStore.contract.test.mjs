import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { RuntimeOperationStore } from '../src/core/RuntimeOperationStore.js';

function setupTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ask-runtime-operation-store-'));
}

test('runtime operation store serializes overlapping writes to valid JSON', async () => {
  const repoDir = setupTempRepo();
  const store = new RuntimeOperationStore(repoDir);
  const writes = [];
  const originalWriteJson = store.store.writeJson.bind(store.store);

  store.store.writeJson = async (filePath, payload) => {
    writes.push(payload.status);
    if (payload.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    return originalWriteJson(filePath, payload);
  };

  const running = store.write({ operation: 'race-test', status: 'running' });
  const succeeded = store.write({ operation: 'race-test', status: 'succeeded' });
  await Promise.all([running, succeeded]);

  const state = await store.read();
  assert.equal(state.operation, 'race-test');
  assert.equal(state.status, 'succeeded');
  assert.deepEqual(writes, ['running', 'succeeded']);
});
