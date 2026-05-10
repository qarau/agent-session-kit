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

test('current runtime artifact contracts are exported from the v6 contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /currentArtifacts\.js/u);
  assert.match(index, /shared\.js/u);

  const shared = readContract('shared.ts');
  assert.match(shared, /export type JsonObject/u);
  assert.match(shared, /export type IsoTimestamp/u);

  const artifacts = readContract('currentArtifacts.ts');
  assert.match(artifacts, /export interface CurrentRuntimeEventRecord/u);
  assert.match(artifacts, /export interface CurrentSequenceState/u);
  assert.match(artifacts, /export interface CurrentProjectionState/u);
  assert.match(artifacts, /export interface CurrentActiveSession/u);
  assert.match(artifacts, /export interface CurrentTaskBoardSnapshot/u);
  assert.match(artifacts, /export interface CurrentPlanBatchRegistry/u);
});

test('current artifact type fixtures are included in TypeScript compilation', () => {
  const fixture = readContract('currentArtifactFixtures.ts');
  assert.match(fixture, /satisfies CurrentRuntimeEventRecord/u);
  assert.match(fixture, /satisfies CurrentTaskBoardSnapshot/u);
  assert.match(fixture, /satisfies CurrentPlanBatchRegistry/u);
});
