import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { QueueClassRegistry } from '../src/policy/QueueClassRegistry.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const contractsDir = path.join(askCoreRoot, 'src', 'contracts');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

test('worker and queue contracts are exported from the v6 contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /workers\.js/u);
  assert.match(index, /queues\.js/u);
  assert.match(index, /workerQueueFixtures\.js/u);

  const workers = readContract('workers.ts');
  for (const symbol of [
    'AskWorkerRole',
    'AskWorkerAssignment',
    'AskWorkerExecutionStatus',
  ]) {
    assert.match(workers, new RegExp(`export (type|interface) ${symbol}`, 'u'));
  }
  for (const role of ['orchestrator', 'builder', 'validator', 'committer', 'projector']) {
    assert.match(workers, new RegExp(`'${role}'`, 'u'));
  }

  const queues = readContract('queues.ts');
  assert.match(queues, /ASK_QUEUE_CLASSES/u);
  for (const queueClass of ['planner', 'implementer', 'verifier', 'debugger', 'integrator', 'reviewer']) {
    assert.match(queues, new RegExp(`'${queueClass}'`, 'u'));
  }
});

test('worker and queue fixtures are included in TypeScript compilation', () => {
  const fixture = readContract('workerQueueFixtures.ts');
  assert.match(fixture, /satisfies AskWorkerAssignment/u);
  assert.match(fixture, /satisfies AskQueueAssignment/u);
});

test('contract queue classes match current registry behavior', () => {
  const registry = new QueueClassRegistry();
  assert.deepEqual(registry.list(), ['planner', 'implementer', 'verifier', 'debugger', 'integrator', 'reviewer']);
  for (const queueClass of registry.list()) {
    assert.equal(registry.has(queueClass), true, queueClass);
  }
  for (const queueClass of ['builder', 'committer', 'projector', 'release']) {
    assert.equal(registry.has(queueClass), false, queueClass);
  }
});
