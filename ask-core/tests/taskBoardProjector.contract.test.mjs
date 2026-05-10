import assert from 'node:assert/strict';
import test from 'node:test';
import { TaskBoardProjector } from '../src/runtime/projectors/TaskBoardProjector.js';

function event(type, taskId, payload = {}, overrides = {}) {
  return {
    seq: overrides.seq ?? 1,
    ts: overrides.ts ?? '2026-05-10T00:00:00.000Z',
    type,
    taskId,
    payload,
  };
}

test('TaskBoardProjector ignores taskless and unknown events', () => {
  const projector = new TaskBoardProjector();
  const initial = projector.initialState();

  assert.deepEqual(initial, { tasks: {} });
  assert.equal(projector.apply(initial, event('TaskCreated', '', { title: 'No task' })), initial);
  assert.equal(projector.apply(initial, event('UnknownEvent', 'task-1')), initial);
});

test('TaskBoardProjector projects task lifecycle events while preserving existing task fields', () => {
  const projector = new TaskBoardProjector();
  const origin = {
    type: 'plan-ingest',
    taskId: 'plan-mode-handoff',
    runId: 'run-1',
    artifactHash: 'sha256:abc',
    planBatchId: 'batch-1',
    sliceIndex: 1,
    sliceId: 'slice-1',
  };

  let state = projector.apply(projector.initialState(), event('TaskCreated', 'task-1', {
    title: 'Implement projection',
    description: 'Project task events',
    origin,
    acceptanceCriteria: [' keep ', '', 'ship'],
    queueClassHint: 'integrator',
  }, { seq: 10, ts: '2026-05-10T01:00:00.000Z' }));

  assert.deepEqual(state.tasks['task-1'], {
    taskId: 'task-1',
    status: 'created',
    title: 'Implement projection',
    description: 'Project task events',
    origin,
    acceptanceCriteria: ['keep', 'ship'],
    queueClassHint: 'integrator',
    refactorGovernance: null,
    owner: '',
    dependencies: [],
    createdAt: '2026-05-10T01:00:00.000Z',
    updatedAt: '2026-05-10T01:00:00.000Z',
    lastEventSeq: 10,
    lastEventType: 'TaskCreated',
  });

  state = projector.apply(state, event('TaskAssigned', 'task-1', { owner: 'codex' }, { seq: 11 }));
  assert.equal(state.tasks['task-1'].owner, 'codex');
  assert.equal(state.tasks['task-1'].title, 'Implement projection');
  assert.equal(state.tasks['task-1'].lastEventSeq, 11);

  state = projector.apply(state, event('TaskStarted', 'task-1', {}, { seq: 12 }));
  assert.equal(state.tasks['task-1'].status, 'in-progress');

  state = projector.apply(state, event('TaskCompleted', 'task-1', {}, { seq: 13 }));
  assert.equal(state.tasks['task-1'].status, 'completed');

  state = projector.apply(state, event('TaskReopened', 'task-1', {}, { seq: 14 }));
  assert.equal(state.tasks['task-1'].status, 'in-progress');

  state = projector.apply(state, event('TaskBlocked', 'task-1', {}, { seq: 15 }));
  assert.equal(state.tasks['task-1'].status, 'blocked');
});

test('TaskBoardProjector merges dependencies as sorted unique task ids', () => {
  const projector = new TaskBoardProjector();
  let state = projector.apply(projector.initialState(), event('TaskCreated', 'task-1', { title: 'Depends' }));

  state = projector.apply(state, event('TaskDependencyAdded', 'task-1', { dependencyTaskId: 'task-c' }));
  state = projector.apply(state, event('TaskDependencyAdded', 'task-1', { dependencyTaskId: 'task-a' }));
  state = projector.apply(state, event('TaskDependencyAdded', 'task-1', { dependencyTaskId: 'task-c' }));
  state = projector.apply(state, event('TaskDependencyAdded', 'task-1', { dependencyTaskId: '' }));

  assert.deepEqual(state.tasks['task-1'].dependencies, ['task-a', 'task-c']);
});

test('TaskBoardProjector projects refactor approval while preserving task metadata', () => {
  const projector = new TaskBoardProjector();
  let state = projector.apply(projector.initialState(), event('TaskCreated', 'refactor-1', {
    title: 'Refactor target',
    description: 'Reduce coupling',
    origin: {
      type: 'ohder-refactor-governance',
      recommendationFingerprint: 'fingerprint-1',
      targetId: 'ask-core/src/runtime/projectors/TaskBoardProjector.js',
      confidence: 'medium',
      approvalRequired: true,
      refactorBaseline: { architectureScore: 94 },
      refactorExecutionPlan: { actions: [{ type: 'extract-helper' }] },
    },
    acceptanceCriteria: ['preserve behavior'],
    queueClassHint: 'integrator',
  }, { seq: 20, ts: '2026-05-10T02:00:00.000Z' }));

  state = projector.apply(state, event('RefactorApproved', 'refactor-1', {
    approvedBy: 'architect',
  }, { seq: 21, ts: '2026-05-10T02:10:00.000Z' }));

  assert.equal(state.tasks['refactor-1'].status, 'created');
  assert.equal(state.tasks['refactor-1'].title, 'Refactor target');
  assert.deepEqual(state.tasks['refactor-1'].acceptanceCriteria, ['preserve behavior']);
  assert.deepEqual(state.tasks['refactor-1'].refactorGovernance, {
    recommendationFingerprint: 'fingerprint-1',
    targetId: 'ask-core/src/runtime/projectors/TaskBoardProjector.js',
    confidence: 'medium',
    approvalRequired: false,
    approvalStatus: 'approved',
    approvedBy: 'architect',
    approvedAt: '2026-05-10T02:10:00.000Z',
    rejectedReason: '',
    executionPlan: { actions: [{ type: 'extract-helper' }] },
    baseline: { architectureScore: 94 },
  });
});

test('TaskBoardProjector projects refactor rejection as blocked while preserving metadata', () => {
  const projector = new TaskBoardProjector();
  let state = projector.apply(projector.initialState(), event('TaskCreated', 'refactor-2', {
    title: 'Refactor risky target',
    description: 'Needs review',
    origin: {
      type: 'ohder-refactor-governance',
      recommendationFingerprint: 'fingerprint-2',
      targetId: 'ask-core/src/core/SliceCloseRuntime.js',
      confidence: 'high',
      approvalRequired: true,
      refactorExecutionPlan: { actions: [{ type: 'split-runtime' }] },
    },
    acceptanceCriteria: ['document rejection'],
  }, { seq: 30, ts: '2026-05-10T03:00:00.000Z' }));

  state = projector.apply(state, event('RefactorRejected', 'refactor-2', {
    reason: 'scope too broad for this slice',
  }, { seq: 31, ts: '2026-05-10T03:15:00.000Z' }));

  assert.equal(state.tasks['refactor-2'].status, 'blocked');
  assert.equal(state.tasks['refactor-2'].title, 'Refactor risky target');
  assert.equal(state.tasks['refactor-2'].description, 'Needs review');
  assert.deepEqual(state.tasks['refactor-2'].acceptanceCriteria, ['document rejection']);
  assert.deepEqual(state.tasks['refactor-2'].refactorGovernance, {
    recommendationFingerprint: 'fingerprint-2',
    targetId: 'ask-core/src/core/SliceCloseRuntime.js',
    confidence: 'high',
    approvalRequired: true,
    approvalStatus: 'rejected',
    approvedBy: '',
    rejectedReason: 'scope too broad for this slice',
    rejectedAt: '2026-05-10T03:15:00.000Z',
    executionPlan: { actions: [{ type: 'split-runtime' }] },
  });
});
