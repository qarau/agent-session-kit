import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');

function readContract(relativePath) {
  return fs.readFileSync(path.join(askCoreRoot, 'src', 'contracts', relativePath), 'utf8');
}

test('runtime snapshot contracts are exported from the TypeScript contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /runtimeSnapshots\.js/u);

  const snapshots = readContract('runtimeSnapshots.ts');
  for (const symbol of [
    'AskRuntimeSessionSnapshot',
    'AskRuntimeTaskBoardSnapshot',
    'AskRuntimeTaskIndexedSnapshot',
    'AskRuntimeSnapshotArtifacts',
    'askRuntimeSessionSnapshotFixture',
    'askRuntimeTaskBoardSnapshotFixture',
    'askRuntimeTaskIndexedSnapshotFixture',
    'askRuntimeSnapshotArtifactsFixture',
  ]) {
    assert.match(snapshots, new RegExp(`export (interface|type|const) ${symbol}\\b`, 'u'));
  }

  assert.match(snapshots, /AskProjectionCursorState/u);
  assert.match(snapshots, /AskProjectionReplayProof/u);
});

test('runtime snapshot fixtures compile against current snapshot field names', () => {
  const snapshots = readContract('runtimeSnapshots.ts');
  assert.match(snapshots, /satisfies AskRuntimeSessionSnapshot/u);
  assert.match(snapshots, /satisfies AskRuntimeTaskBoardSnapshot/u);
  assert.match(snapshots, /satisfies AskRuntimeTaskIndexedSnapshot/u);
  assert.match(snapshots, /satisfies AskRuntimeSnapshotArtifacts/u);
  assert.match(snapshots, /tasks:/u);
  assert.match(snapshots, /projectionState:/u);
  assert.match(snapshots, /replayProof:/u);
});
