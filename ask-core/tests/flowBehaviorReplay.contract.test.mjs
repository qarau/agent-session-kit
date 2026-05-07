import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { AskPaths } from '../src/fs/AskPaths.js';
import { FileStore } from '../src/fs/FileStore.js';
import { FlowRuntime } from '../src/core/FlowRuntime.js';

function setupRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-flow-replay-'));
}

test('flow validation emits passing behavior replay with confidence score when evidence is healthy', async () => {
  const repoDir = setupRepo();
  const scaffolder = new Scaffolder(repoDir);
  await scaffolder.init();
  const paths = new AskPaths(repoDir);
  const store = new FileStore();

  await store.writeJson(paths.productFlowContract(), {
    version: 1,
    flows: [
      {
        id: 'checkout-flow',
        name: 'Checkout Flow',
        stage: 'protected',
        criticality: 'protected',
        given: 'Cart has items',
        when: 'User checks out',
        then: ['Order is created'],
        mustNever: ['Checkout clears cart without creating order'],
      },
    ],
  });
  await store.writeJson(paths.flowMap(), {
    'checkout-flow': {
      files: ['src/**'],
      tests: ['checkout-flow'],
    },
  });

  const runtime = new FlowRuntime(repoDir);
  const payload = await runtime.validate({
    slice: { id: 'slice_replay_pass' },
    execution: {
      ok: true,
      touchedFiles: ['src/checkout/CheckoutPage.js'],
    },
    validation: {
      status: 'passed',
      testsRun: ['npm run checkout-flow'],
      warnings: [],
      failures: [],
    },
    policy: {
      flow: {
        enabled: true,
        behavior_replay_enabled: true,
        min_behavior_replay_confidence: 0.65,
        min_protected_replay_confidence: 0.75,
        min_hard_flow_replay_confidence: 0.85,
        block_on_hard_flow_violation: true,
        block_on_protected_flow_violation: false,
      },
    },
  });

  assert.equal(payload.status, 'passed');
  assert.equal(payload.blocking, false);
  assert.equal(payload.behaviorReplay.status, 'passed');
  assert.equal(payload.behaviorReplay.confidence >= 0.75, true);
  assert.equal(payload.protectedFlowViolations.length, 0);
});

test('flow validation flags hard-flow replay regressions with confidence and evidence', async () => {
  const repoDir = setupRepo();
  const scaffolder = new Scaffolder(repoDir);
  await scaffolder.init();
  const paths = new AskPaths(repoDir);
  const store = new FileStore();

  await store.writeJson(paths.productFlowContract(), {
    version: 1,
    flows: [
      {
        id: 'task-completion-order',
        name: 'Task completion order',
        stage: 'hard-flow',
        criticality: 'hard-flow',
        given: 'Tasks include completed and incomplete',
        when: 'User completes a task',
        then: ['Task moves below incomplete tasks'],
        mustNever: ['Completed tasks remain above incomplete tasks'],
      },
    ],
  });
  await store.writeJson(paths.flowMap(), {
    'task-completion-order': {
      files: ['src/**'],
      tests: ['task-completion-order'],
    },
  });

  const runtime = new FlowRuntime(repoDir);
  const payload = await runtime.validate({
    slice: { id: 'slice_replay_fail' },
    execution: {
      ok: true,
      touchedFiles: ['src/todo/TodoList.js'],
    },
    validation: {
      status: 'passed',
      testsRun: ['npm test'],
      warnings: ['Completed tasks remain above incomplete tasks when toggled rapidly'],
      failures: [],
    },
    policy: {
      flow: {
        enabled: true,
        behavior_replay_enabled: true,
        min_behavior_replay_confidence: 0.65,
        min_protected_replay_confidence: 0.75,
        min_hard_flow_replay_confidence: 0.85,
        block_on_hard_flow_violation: true,
        block_on_protected_flow_violation: false,
      },
    },
  });

  assert.equal(payload.blocking, true);
  assert.equal(payload.hardFlowViolations.length > 0, true);
  assert.equal(payload.behaviorReplay.status, 'failed');
  assert.equal(payload.behaviorReplay.confidence < 0.85, true);
  assert.equal(payload.behaviorReplay.regressionEvidence.some(item => item.type === 'must-never-risk'), true);
});
