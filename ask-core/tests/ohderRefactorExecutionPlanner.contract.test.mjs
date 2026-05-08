import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderRefactorExecutionPlannerEngine } from '../src/core/OhderRefactorExecutionPlannerEngine.js';
import { TaskBoardProjector } from '../src/runtime/projectors/TaskBoardProjector.js';

test('refactor execution planner creates split-doc-section plans for doc targets', () => {
  const engine = new OhderRefactorExecutionPlannerEngine();

  const plan = engine.plan({
    recommendation: {
      target: {
        type: 'documentation',
        path: 'README.md',
      },
    },
  });

  assert.equal(plan.actions[0].type, 'split-doc-section');
  assert.equal(plan.actions[0].targetPath, 'README.md');
  assert.equal(plan.approvalRequired, false);
});

test('refactor execution planner creates approval-required cross-layer import plans', () => {
  const engine = new OhderRefactorExecutionPlannerEngine();

  const plan = engine.plan({
    recommendation: {
      target: {
        type: 'runtime',
        path: 'ask-core/src/core/BadCore.js',
      },
    },
    architect: {
      couplingAnalysis: {
        crossLayerImports: [
          {
            filePath: 'ask-core/src/core/BadCore.js',
            fromLayer: 'core',
            toLayer: 'cli',
          },
        ],
      },
    },
  });

  assert.equal(plan.risk, 'high');
  assert.equal(plan.approvalRequired, true);
  assert.equal(plan.actions[0].type, 'reduce-cross-layer-import');
});

test('refactor execution plan can be embedded in task metadata', () => {
  const engine = new OhderRefactorExecutionPlannerEngine();
  const executionPlan = engine.plan({
    recommendation: {
      target: {
        type: 'documentation',
        path: 'docs/operations/runtime-architecture.md',
      },
    },
  });
  const projector = new TaskBoardProjector();
  const state = projector.apply(projector.initialState(), {
    type: 'TaskCreated',
    taskId: 'refactor-docs',
    ts: '2026-05-08T00:00:00.000Z',
    seq: 1,
    payload: {
      title: 'Refactor docs',
      origin: {
        type: 'ohder-refactor-governance',
        recommendationFingerprint: 'abc',
        targetId: 'docs',
        confidence: 'medium',
        approvalRequired: executionPlan.approvalRequired,
        refactorExecutionPlan: executionPlan,
      },
    },
  });

  assert.deepEqual(state.tasks['refactor-docs'].origin.refactorExecutionPlan, executionPlan);
  assert.deepEqual(state.tasks['refactor-docs'].refactorGovernance.executionPlan, executionPlan);
});
