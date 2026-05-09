import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const fixturesDir = path.join(testsDir, 'fixtures', 'contracts');

function readFixture(fileName) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, fileName), 'utf8'));
}

test('contract JSON fixtures cover current runtime artifact families', () => {
  const required = [
    'event-ledger-record.json',
    'task-board-entry.json',
    'plan-batch-record.json',
    'pre-push-result.json',
    'ohder-finding.json',
    'ofrr-resolution.json',
  ];
  for (const fileName of required) {
    assert.equal(fs.existsSync(path.join(fixturesDir, fileName)), true, fileName);
  }
});

test('contract JSON fixtures preserve representative runtime field names', () => {
  const event = readFixture('event-ledger-record.json');
  assert.equal(typeof event.type, 'string');
  assert.equal(typeof event.payload, 'object');
  assert.equal(typeof event.meta.schemaVersion, 'number');

  const task = readFixture('task-board-entry.json');
  assert.equal(typeof task.taskId, 'string');
  assert.equal(typeof task.status, 'string');
  assert.equal(typeof task.origin.planBatchId, 'string');

  const planBatch = readFixture('plan-batch-record.json');
  assert.equal(typeof planBatch.planBatchId, 'string');
  assert.equal(Array.isArray(planBatch.slices), true);
  assert.equal(typeof planBatch.slices[0].origin.artifactHash, 'string');

  const prePush = readFixture('pre-push-result.json');
  assert.equal(typeof prePush.passed, 'boolean');
  assert.equal(Array.isArray(prePush.commitGovernance.checkedCommits), true);

  const finding = readFixture('ohder-finding.json');
  assert.equal(typeof finding.id, 'string');
  assert.equal(typeof finding.evidenceRef, 'string');
  assert.equal(finding.resolution, null);

  const resolution = readFixture('ofrr-resolution.json');
  assert.equal(typeof resolution.findingId, 'string');
  assert.equal(typeof resolution.decision, 'string');
  assert.equal(typeof resolution.approvedBy, 'string');
});
