import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const contractsDir = path.join(askCoreRoot, 'src', 'contracts');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

test('runtime event contracts preserve current ASK event envelope shape', () => {
  const index = readContract('index.ts');
  assert.match(index, /events\.js/u);

  const events = readContract('events.ts');
  assert.match(events, /export type AskRuntimeEventType/u);
  assert.match(events, /export interface AskRuntimeEvent/u);
  assert.match(events, /seq: number/u);
  assert.match(events, /ts: IsoTimestamp/u);
  assert.match(events, /sessionId: string/u);
  assert.match(events, /actor: string/u);
  assert.doesNotMatch(events, /timestamp:/u);
});

test('runtime event contracts type current high-value event payloads', () => {
  const events = readContract('events.ts');
  for (const symbol of [
    'TaskCreatedPayload',
    'TaskStartedPayload',
    'TaskCompletedPayload',
    'PlanModeHandoffIngestedPayload',
    'ArchitectValidationCompletedPayload',
    'EntropyImpactMeasuredPayload',
    'OhderFindingDetectedPayload',
  ]) {
    assert.match(events, new RegExp(`export interface ${symbol}`, 'u'));
  }
});

test('runtime event fixtures are included in TypeScript compilation', () => {
  const fixture = readContract('eventFixtures.ts');
  assert.match(fixture, /satisfies TaskCreatedEvent/u);
  assert.match(fixture, /satisfies PlanModeHandoffIngestedEvent/u);
  assert.match(fixture, /satisfies ArchitectValidationCompletedEvent/u);
  assert.match(fixture, /satisfies EntropyImpactMeasuredEvent/u);
  assert.match(fixture, /satisfies OhderFindingDetectedEvent/u);
});
