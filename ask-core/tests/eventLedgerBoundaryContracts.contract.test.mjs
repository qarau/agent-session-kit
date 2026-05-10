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

test('event ledger boundary contracts are exported from the TypeScript contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /eventLedger\.js/u);

  const contract = readContract('eventLedger.ts');
  for (const symbol of [
    'AskEventLedgerAppendInput',
    'AskEventLedgerAppendResult',
    'AskEventLedgerReadAllResult',
    'AskEventLedgerSequencingAssumptions',
    'askEventLedgerAppendInputFixture',
    'askEventLedgerAppendResultFixture',
  ]) {
    assert.match(contract, new RegExp(`export (interface|type|const) ${symbol}\\b`, 'u'));
  }
});

test('event ledger boundary contracts preserve required event envelope fields', () => {
  const contract = readContract('eventLedger.ts');
  for (const field of [
    'seq: number',
    'type: AskRuntimeEventType',
    'ts: IsoTimestamp',
    'sessionId: string',
    'taskId?: string',
    'actor: string',
    'payload: TPayload',
    'meta: TMeta',
  ]) {
    assert.match(contract, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  assert.match(contract, /orderedBySeq: true/u);
  assert.match(contract, /metadataPreserved: true/u);
});
