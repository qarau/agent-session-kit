import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const contractsDir = path.resolve(testsDir, '..', 'src', 'contracts');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

test('typed governance runtime boundary exports identity helpers for current records', () => {
  const index = readContract('index.ts');
  assert.match(index, /governanceRuntimeBoundary\.js/u);

  const boundary = readContract('governanceRuntimeBoundary.ts');
  assert.match(boundary, /AskOhderFinding/u);
  assert.match(boundary, /AskOhderFindingResolution/u);
  assert.match(boundary, /export function defineAskOhderFinding/u);
  assert.match(boundary, /export function defineAskOhderFindingResolution/u);
  assert.match(boundary, /return finding;/u);
  assert.match(boundary, /return resolution;/u);

  const fixtures = readContract('governanceFixtures.ts');
  assert.match(fixtures, /defineAskOhderFinding\(/u);
  assert.match(fixtures, /defineAskOhderFindingResolution\(/u);
});
