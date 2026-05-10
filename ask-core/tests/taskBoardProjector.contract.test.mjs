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
