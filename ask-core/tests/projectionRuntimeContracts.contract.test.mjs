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

test('projection cursor contracts are exported from the TypeScript contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /projection\.js/u);

  const contract = readContract('projection.ts');
  for (const symbol of [
    'AskProjectionCursorState',
    'AskProjectionSequenceIntegrity',
    'AskProjectionReplayProof',
    'AskProjectionRunSummary',
    'askProjectionCursorStateFixture',
    'askProjectionReplayProofFixture',
    'askProjectionRunSummaryFixture',
  ]) {
    assert.match(contract, new RegExp(`export (interface|type|const) ${symbol}\\b`, 'u'));
  }
});

test('projection cursor contract fixtures are included in TypeScript compilation', () => {
  const contract = readContract('projection.ts');
  assert.match(contract, /satisfies AskProjectionCursorState/u);
  assert.match(contract, /satisfies AskProjectionReplayProof/u);
  assert.match(contract, /satisfies AskProjectionRunSummary/u);
});
