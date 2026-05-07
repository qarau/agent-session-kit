import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderRefactorRecommendationEngine } from '../src/core/OhderRefactorRecommendationEngine.js';

function recommend(input = {}) {
  const engine = new OhderRefactorRecommendationEngine();
  return engine.recommend({
    architect: {
      status: 'passed',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 99,
      },
    },
    entropy: {
      trend: 'stable',
      refactorPressure: 'none',
      entropyScore: 0.03,
    },
    policy: {},
    ...input,
  });
}

test('high entropy pressure produces a deterministic high-confidence refactor recommendation', () => {
  const input = {
    architect: {
      status: 'warning',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 91,
      },
    },
    entropy: {
      trend: 'regressing',
      refactorPressure: 'high',
      entropyScore: 0.42,
      couplingTrend: 'increasing',
      replayabilityTrend: 'stable',
    },
  };

  const first = recommend(input);
  const second = recommend(input);

  assert.equal(first.confidence, 'high');
  assert.equal(first.title, 'Reduce OHDER entropy pressure');
  assert.match(first.reason, /entropy trend is regressing/i);
  assert.ok(first.targetSignals.includes('entropy.trend:regressing'));
  assert.ok(first.targetSignals.includes('entropy.refactorPressure:high'));
  assert.deepEqual(first, second);
});

test('blocking architecture status produces a repair recommendation with law signals', () => {
  const recommendation = recommend({
    architect: {
      status: 'failed',
      blocking: true,
      reason: 'ProjectionAuthority violated',
      replayabilityRisk: 'high',
      lawViolations: [
        {
          id: 'ProjectionAuthority',
          severity: 'critical',
          message: 'Direct StateManager mutation detected',
        },
      ],
      architectureScore: {
        overallScore: 61,
      },
    },
  });

  assert.equal(recommendation.confidence, 'high');
  assert.equal(recommendation.blocking, true);
  assert.match(recommendation.title, /Resolve OHDER architecture block/u);
  assert.match(recommendation.objective, /repair blocking architecture/i);
  assert.ok(recommendation.targetSignals.includes('architect.blocking:true'));
  assert.ok(recommendation.targetSignals.includes('law.ProjectionAuthority:critical'));
});

test('refactor governance hint produces at least medium confidence recommendation', () => {
  const recommendation = recommend({
    refactorGovernance: {
      required: true,
      reason: 'entropy-delta 5 exceeded budget',
      severity: 'medium',
      hint: {
        title: 'Refactor Governance: runtime slice',
        objective: 'Reduce entropy/coupling risk and preserve replayability',
        recommendations: ['Reduce change surface'],
      },
    },
  });

  assert.equal(recommendation.confidence, 'medium');
  assert.equal(recommendation.title, 'Refactor Governance: runtime slice');
  assert.match(recommendation.reason, /entropy-delta/u);
  assert.ok(recommendation.targetSignals.includes('refactorGovernance.required:true'));
});

test('low architecture score produces score target signals', () => {
  const recommendation = recommend({
    architect: {
      status: 'warning',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 64,
      },
    },
    policy: {
      ohder_refactor: {
        minimum_architecture_score: 70,
      },
    },
  });

  assert.equal(recommendation.confidence, 'medium');
  assert.match(recommendation.reason, /architecture score 64 is below minimum 70/u);
  assert.ok(recommendation.targetSignals.includes('architectureScore:64'));
});

test('healthy architecture and entropy state produces no recommendation', () => {
  assert.equal(recommend(), null);
});
