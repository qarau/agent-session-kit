import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const runtimeDir = path.join(askCoreRoot, 'src', 'runtime');
const srcDir = path.join(askCoreRoot, 'src');

function readRuntime(relativePath) {
  return fs.readFileSync(path.join(runtimeDir, relativePath), 'utf8');
}

function readSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(fullPath);
    }
    if (!/\.(js|mjs|ts)$/u.test(entry.name)) {
      return [];
    }
    return [fullPath];
  });
}

test('RuntimeSnapshotStore TypeScript helper exports typed default and normalization helpers', () => {
  const helper = readRuntime('RuntimeSnapshotStoreRuntime.ts');
  for (const symbol of [
    'AskRuntimeSnapshotClock',
    'createDefaultProjectionState',
    'createDefaultReplayProof',
    'normalizeProjectionState',
    'mergeReplayProof',
    'askRuntimeSnapshotProjectionStateFixture',
    'askRuntimeSnapshotReplayProofFixture',
  ]) {
    assert.match(helper, new RegExp(`export (type|const|function) ${symbol}\\b`, 'u'));
  }
  assert.match(helper, /AskProjectionCursorState/u);
  assert.match(helper, /AskProjectionReplayProof/u);
});

test('source-run runtime files do not import the TypeScript snapshot helper directly', () => {
  const offenders = readSourceFiles(srcDir)
    .filter(filePath => !filePath.endsWith(`${path.sep}RuntimeSnapshotStoreRuntime.ts`))
    .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('RuntimeSnapshotStoreRuntime.ts'));

  assert.deepEqual(offenders, []);
});

test('RuntimeSnapshotStore source runtime delegates defaults through source-compatible helper', () => {
  const store = readRuntime('RuntimeSnapshotStore.js');
  assert.match(store, /from '\.\/RuntimeSnapshotStoreRuntime\.js'/u);
  assert.match(store, /\bcreateDefaultProjectionState\b/u);
  assert.match(store, /\bcreateDefaultReplayProof\b/u);
  assert.match(store, /\bnormalizeProjectionState\b/u);
  assert.match(store, /\bmergeReplayProof\b/u);

  const helper = readRuntime('RuntimeSnapshotStoreRuntime.js');
  for (const symbol of [
    'createDefaultProjectionState',
    'createDefaultReplayProof',
    'normalizeProjectionState',
    'mergeReplayProof',
  ]) {
    assert.match(helper, new RegExp(`export function ${symbol}\\b`, 'u'));
  }
});
