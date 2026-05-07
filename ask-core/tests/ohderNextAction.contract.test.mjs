import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderNextActionEngine } from '../src/core/OhderNextActionEngine.js';

function decide(input = {}) {
  const engine = new OhderNextActionEngine();
  return engine.decide({
    state: {},
    architect: {},
    refactorGovernance: {},
    tasks: {},
    ...input,
  });
}

test('OHDER next action does not override active or ready task pressure', () => {
  assert.equal(decide({
    tasks: {
      active: [{ taskId: 'active-001' }],
      ready: [],
    },
    architect: {
      blocking: true,
    },
  }), null);

  assert.equal(decide({
    tasks: {
      active: [],
      ready: [{ taskId: 'ready-001' }],
    },
    architect: {
      blocking: true,
    },
  }), null);
});

test('OHDER next action resolves blocking architect status first', () => {
  const decision = decide({
    architect: {
      status: 'failed',
      blocking: true,
      reason: 'ProjectionAuthority violated',
      architectureScore: {
        overallScore: 61,
      },
    },
    refactorGovernance: {
      required: true,
    },
  });

  assert.equal(decision.type, 'ohder-action');
  assert.equal(decision.action, 'resolve-architecture-block');
  assert.equal(decision.blocking, true);
  assert.equal(decision.architectStatus, 'failed');
  assert.equal(decision.architectureScore, 61);
  assert.match(decision.reason, /ProjectionAuthority/u);
});

test('OHDER next action creates refactor slice when refactor governance is required', () => {
  const decision = decide({
    architect: {
      status: 'warning',
      blocking: false,
      architectureScore: {
        overallScore: 89,
      },
    },
    refactorGovernance: {
      required: true,
      reason: 'entropy-delta 5 exceeded budget',
    },
  });

  assert.equal(decision.type, 'ohder-action');
  assert.equal(decision.action, 'create-refactor-slice');
  assert.equal(decision.blocking, false);
  assert.equal(decision.recommendedCommand, 'ask task create <refactor-task-id>');
  assert.match(decision.reason, /entropy-delta/u);
});

test('OHDER next action requests governance validation for high replayability or low score', () => {
  const replayDecision = decide({
    architect: {
      status: 'warning',
      blocking: false,
      replayabilityRisk: 'high',
      architectureScore: {
        overallScore: 92,
      },
    },
  });

  assert.equal(replayDecision.action, 'run-governance-validation');
  assert.equal(replayDecision.recommendedCommand, 'ask governance status');

  const scoreDecision = decide({
    architect: {
      status: 'warning',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 69,
      },
    },
  });

  assert.equal(scoreDecision.action, 'run-governance-validation');
});

test('OHDER next action awaits new requirement when architecture is healthy', () => {
  const decision = decide({
    architect: {
      status: 'passed',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 99,
      },
    },
  });

  assert.equal(decision.type, 'ohder-action');
  assert.equal(decision.action, 'await-new-requirement');
  assert.equal(decision.blocking, false);
  assert.equal(decision.source, 'ohder-next-action');
  assert.equal(decision.architectureScore, 99);
});
