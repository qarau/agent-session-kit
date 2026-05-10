import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderPatchReadinessGate } from '../src/core/OhderPatchReadinessGate.js';

const baseInput = {
  recommendation: {
    confidence: 'high',
    targetPortfolio: [
      {
        selected: true,
        blastRadius: 'low',
      },
    ],
  },
  matchingTests: ['unit'],
  rollbackPlan: 'Revert the generated patch commit and rerun ASK validation.',
  cleanWorktree: true,
  approval: {
    required: false,
    approved: true,
  },
  semanticFacts: [
    {
      metric: 'testability_risk',
      value: 'low',
      confidence: 'low',
    },
  ],
};

test('low or medium confidence is not patch ready', () => {
  const low = new OhderPatchReadinessGate().evaluate({
    ...baseInput,
    recommendation: {
      ...baseInput.recommendation,
      confidence: 'medium',
    },
  });

  assert.equal(low.patchReady, false);
  assert.ok(low.blockers.includes('recommendation confidence must be high'));
});

test('missing tests or rollback plan blocks readiness', () => {
  const result = new OhderPatchReadinessGate().evaluate({
    ...baseInput,
    matchingTests: [],
    rollbackPlan: '',
  });

  assert.equal(result.patchReady, false);
  assert.ok(result.blockers.includes('matching tests are required'));
  assert.ok(result.blockers.includes('rollback plan is required'));
});

test('high confidence low blast radius with tests and rollback is patch ready to consider', () => {
  const result = new OhderPatchReadinessGate().evaluate(baseInput);

  assert.equal(result.patchReady, true);
  assert.equal(result.patchExecutionAllowed, false);
  assert.deepEqual(result.blockers, []);
});
