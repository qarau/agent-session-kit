import assert from 'node:assert/strict';
import test from 'node:test';
import { RuntimeDriftAnalyticsEngine } from '../src/core/RuntimeDriftAnalyticsEngine.js';

test('drift analytics computes regressing trend from worsening architecture and behavior signals', () => {
  const engine = new RuntimeDriftAnalyticsEngine();
  const analytics = engine.compute([
    {
      entropyDelta: 1,
      couplingDelta: 1,
      replayabilityRisk: 'low',
      behaviorReplayConfidence: 0.95,
      protectedFlowViolations: 0,
      hardFlowViolations: 0,
    },
    {
      entropyDelta: 4,
      couplingDelta: 3,
      replayabilityRisk: 'high',
      behaviorReplayConfidence: 0.62,
      protectedFlowViolations: 1,
      hardFlowViolations: 1,
    },
  ], {
    windowSize: 10,
  });

  assert.equal(analytics.overall.trend, 'regressing');
  assert.equal(typeof analytics.architecture.driftScore, 'number');
  assert.equal(typeof analytics.behavior.driftScore, 'number');
});

test('drift analytics computes stable trend when no history is present', () => {
  const engine = new RuntimeDriftAnalyticsEngine();
  const analytics = engine.compute([], { windowSize: 5 });
  assert.equal(analytics.overall.trend, 'stable');
  assert.equal(analytics.windowSize, 0);
});
