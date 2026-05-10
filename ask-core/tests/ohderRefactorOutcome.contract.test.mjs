import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderRefactorOutcomeEngine } from '../src/core/OhderRefactorOutcomeEngine.js';

const refactorTask = {
  taskId: 'ohder-refactor-abc123',
  refactorGovernance: {
    recommendationFingerprint: 'abc123',
    baseline: {
      architectureScore: 80,
      entropyScore: 0.42,
    },
  },
};

test('refactor outcome passes when architecture improves or entropy drops', () => {
  const result = new OhderRefactorOutcomeEngine().evaluate({
    task: refactorTask,
    architect: {
      architectureScore: {
        overallScore: 84,
      },
    },
    entropy: {
      entropyScore: 0.4,
    },
    policy: {
      ohder: {
        mode: 'refactor',
      },
    },
  });

  assert.equal(result.required, true);
  assert.equal(result.status, 'passed');
  assert.equal(result.blocking, false);
});

test('refactor mode blocks unjustified worsening outcomes', () => {
  const result = new OhderRefactorOutcomeEngine().evaluate({
    task: refactorTask,
    architect: {
      architectureScore: {
        overallScore: 78,
      },
    },
    entropy: {
      entropyScore: 0.5,
    },
    policy: {
      ohder: {
        mode: 'refactor',
      },
    },
  });

  assert.equal(result.required, true);
  assert.equal(result.status, 'failed');
  assert.equal(result.blocking, true);
  assert.match(result.reason, /worsened/i);
});

test('worsening refactor outcome can continue with explicit justification outside refactor mode', () => {
  const result = new OhderRefactorOutcomeEngine().evaluate({
    task: {
      ...refactorTask,
      refactorGovernance: {
        ...refactorTask.refactorGovernance,
        outcomeJustification: 'The architecture score drops temporarily while the next slice removes the duplicate runtime path.',
      },
    },
    architect: {
      architectureScore: {
        overallScore: 78,
      },
    },
    entropy: {
      entropyScore: 0.5,
    },
    policy: {
      ohder: {
        mode: 'fast',
      },
    },
  });

  assert.equal(result.status, 'justified');
  assert.equal(result.blocking, false);
  assert.match(result.reason, /justified/i);
});
