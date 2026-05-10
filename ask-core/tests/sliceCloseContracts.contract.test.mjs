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

test('slice close contracts are exported from the TypeScript contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /sliceClose\.js/u);
  assert.match(index, /sliceCloseFixtures\.js/u);

  const contract = readContract('sliceClose.ts');
  for (const expected of [
    'export interface AskSliceCloseCommitResult',
    'export interface AskSliceCloseFullSuiteResult',
    'export interface AskSliceCloseEntropyResult',
    'export interface AskSliceCloseSuccessResult',
    'export interface AskSliceCloseFailureResult',
    'export type AskSliceCloseResult',
  ]) {
    assert.match(contract, new RegExp(expected, 'u'));
  }
});

test('slice close contract fixtures compile against current public payload shapes', () => {
  const fixtures = readContract('sliceCloseFixtures.ts');
  assert.match(fixtures, /satisfies AskSliceCloseSuccessResult/u);
  assert.match(fixtures, /satisfies AskSliceCloseFailureResult/u);
  assert.match(fixtures, /code: 'slice-close-ohder-blocked'/u);
  assert.match(fixtures, /footer: 'ASK-Slice: slice-001'/u);
});

test('source-run runtime files do not import slice-close TypeScript contracts directly', () => {
  const srcRoot = path.join(askCoreRoot, 'src');
  const candidates = fs.readdirSync(path.join(srcRoot, 'core'), { recursive: true })
    .map(relativePath => path.join(srcRoot, 'core', relativePath.toString()))
    .filter(filePath => filePath.endsWith('.js'));

  const offenders = candidates
    .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('sliceClose.ts'));

  assert.deepEqual(offenders, []);
});
