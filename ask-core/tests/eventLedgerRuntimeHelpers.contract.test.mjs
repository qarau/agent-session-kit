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

test('EventLedger TypeScript runtime helper exports typed append and read helpers', () => {
  const helper = readRuntime('EventLedgerRuntime.ts');
  for (const symbol of [
    'AskEventLedgerRuntimeClock',
    'createEventLedgerEnvelope',
    'parseEventLedgerLine',
    'sortEventLedgerRecords',
    'askEventLedgerRuntimeEnvelopeFixture',
    'askEventLedgerRuntimeSortedFixture',
  ]) {
    assert.match(helper, new RegExp(`export (type|const|function) ${symbol}\\b`, 'u'));
  }
  assert.match(helper, /AskEventLedgerAppendInput/u);
  assert.match(helper, /AskEventLedgerAppendResult/u);
});

test('source-run runtime files do not import the TypeScript helper directly', () => {
  const offenders = readSourceFiles(srcDir)
    .filter(filePath => !filePath.endsWith(`${path.sep}EventLedgerRuntime.ts`))
    .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('EventLedgerRuntime.ts'));

  assert.deepEqual(offenders, []);
});

test('EventLedger source runtime delegates behavior through source-compatible helper', () => {
  const ledger = readRuntime('EventLedger.js');
  assert.match(ledger, /from '\.\/EventLedgerRuntime\.js'/u);
  assert.match(ledger, /\bcreateEventLedgerEnvelope\b/u);
  assert.match(ledger, /\bparseEventLedgerLine\b/u);
  assert.match(ledger, /\bsortEventLedgerRecords\b/u);

  const helper = readRuntime('EventLedgerRuntime.js');
  for (const symbol of [
    'createEventLedgerEnvelope',
    'parseEventLedgerLine',
    'sortEventLedgerRecords',
  ]) {
    assert.match(helper, new RegExp(`export function ${symbol}\\b`, 'u'));
  }
});
