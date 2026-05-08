import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderRefactorTargetDiscoveryEngine } from '../src/core/OhderRefactorTargetDiscoveryEngine.js';
import { OhderRefactorRecommendationEngine } from '../src/core/OhderRefactorRecommendationEngine.js';

function portfolioDiscovery(tasks = {}) {
  return new OhderRefactorTargetDiscoveryEngine().discover({
    metricsHistory: [
      {
        taskId: 'slice-001',
        entropyDelta: 2,
        couplingDelta: 1,
        entropyTrend: 'regressing',
        refactorPressure: 'high',
      },
      {
        taskId: 'slice-002',
        entropyDelta: 1,
        couplingDelta: 0,
        entropyTrend: 'stable',
        refactorPressure: 'medium',
      },
      {
        taskId: 'slice-003',
        entropyDelta: 1,
        couplingDelta: 1,
        entropyTrend: 'stable',
        refactorPressure: 'medium',
      },
    ],
    changeSets: [
      {
        taskId: 'slice-001',
        files: ['ask-core/src/core/Hotspot.js', 'ask-core/src/core/Secondary.js'],
      },
      {
        taskId: 'slice-002',
        files: ['ask-core/src/core/Hotspot.js', 'ask-core/src/core/Tertiary.js'],
      },
      {
        taskId: 'slice-003',
        files: ['ask-core/src/core/Hotspot.js'],
      },
    ],
    tasks,
  });
}

test('target discovery exposes ranked portfolio with confidence blast radius and freshness', () => {
  const result = portfolioDiscovery();

  assert.equal(result.target.targetId, 'file:ask-core/src/core/Hotspot.js');
  assert.equal(result.portfolio.length, 3);
  assert.deepEqual(result.portfolio.map(target => target.rank), [1, 2, 3]);
  assert.deepEqual(result.portfolio.map(target => target.targetId), [
    'file:ask-core/src/core/Hotspot.js',
    'file:ask-core/src/core/Secondary.js',
    'file:ask-core/src/core/Tertiary.js',
  ]);
  assert.equal(result.portfolio[0].confidence, 'high');
  assert.equal(result.portfolio[0].blastRadius, 'medium');
  assert.equal(result.portfolio[0].freshness, 'fresh');
  assert.ok(result.portfolio[0].reasons.some(reason => /recurrence/i.test(reason)));
});

test('completed target fingerprints are skipped from portfolio and selected target', () => {
  const result = portfolioDiscovery({
    'ohder-refactor-hotspot': {
      status: 'completed',
      origin: {
        type: 'ohder-refactor-governance',
        targetId: 'file:ask-core/src/core/Hotspot.js',
      },
    },
  });

  assert.equal(result.target.targetId, 'file:ask-core/src/core/Secondary.js');
  assert.equal(result.portfolio.some(target => target.targetId === 'file:ask-core/src/core/Hotspot.js'), false);
});

test('recommendation preserves selected target and includes ranked target portfolio', () => {
  const targetDiscovery = portfolioDiscovery();
  const evaluation = new OhderRefactorRecommendationEngine().evaluate({
    architect: {
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 88,
      },
    },
    entropy: {
      refactorPressure: 'high',
      trend: 'regressing',
    },
    targetDiscovery,
  });

  assert.equal(evaluation.recommendation.target.targetId, 'file:ask-core/src/core/Hotspot.js');
  assert.equal(evaluation.recommendation.targetPortfolio.length, 3);
  assert.equal(evaluation.recommendation.targetPortfolio[0].selected, true);
  assert.equal(evaluation.recommendation.targetPortfolio[1].selected, false);
});
