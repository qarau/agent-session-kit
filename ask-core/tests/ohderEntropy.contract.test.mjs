import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderEntropySnapshotEngine } from '../src/core/OhderEntropySnapshotEngine.js';

function snapshot(input = {}) {
  const engine = new OhderEntropySnapshotEngine();
  return engine.snapshot({
    architect: {},
    previousArchitect: null,
    driftAnalytics: {},
    policy: {},
    ...input,
  });
}

test('OHDER entropy snapshot reports healthy architecture as low entropy with no refactor pressure', () => {
  const result = snapshot({
    architect: {
      status: 'passed',
      blocking: false,
      entropyDelta: 0,
      couplingDelta: 0,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 99,
      },
    },
  });

  assert.equal(result.trend, 'stable');
  assert.equal(result.couplingTrend, 'stable');
  assert.equal(result.replayabilityTrend, 'stable');
  assert.equal(result.architectureScore, 99);
  assert.equal(result.architectureScoreDelta, 0);
  assert.equal(result.refactorPressure, 'none');
  assert.equal(result.blocking, false);
  assert.equal(result.entropyScore < 0.1, true);
  assert.equal(typeof result.measuredAt, 'string');
});

test('OHDER entropy snapshot raises pressure for high replayability risk', () => {
  const result = snapshot({
    architect: {
      status: 'warning',
      blocking: false,
      entropyDelta: 1,
      couplingDelta: 1,
      replayabilityRisk: 'high',
      architectureScore: {
        overallScore: 91,
      },
    },
  });

  assert.equal(result.refactorPressure, 'high');
  assert.equal(result.entropyScore > 0.3, true);
  assert.equal(result.replayabilityRisk, 'high');
});

test('OHDER entropy snapshot raises pressure for low architecture score', () => {
  const result = snapshot({
    architect: {
      status: 'warning',
      blocking: false,
      entropyDelta: 0,
      couplingDelta: 1,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 68,
      },
    },
    policy: {
      ohder_entropy: {
        minimum_architecture_score: 70,
      },
    },
  });

  assert.equal(result.refactorPressure, 'high');
  assert.equal(result.architectureScore, 68);
  assert.equal(result.entropyScore >= 0.32, true);
});

test('OHDER entropy snapshot uses regressing drift analytics trend', () => {
  const result = snapshot({
    architect: {
      status: 'warning',
      blocking: false,
      entropyDelta: 1,
      couplingDelta: 2,
      replayabilityRisk: 'medium',
      architectureScore: {
        overallScore: 86,
      },
    },
    driftAnalytics: {
      architecture: {
        couplingTrend: 'increasing',
        replayabilityTrend: 'increasing',
      },
      overall: {
        trend: 'regressing',
      },
    },
  });

  assert.equal(result.trend, 'regressing');
  assert.equal(result.couplingTrend, 'increasing');
  assert.equal(result.replayabilityTrend, 'increasing');
  assert.equal(result.refactorPressure, 'high');
});

test('OHDER entropy snapshot computes deterministic architecture score deltas', () => {
  const result = snapshot({
    architect: {
      status: 'warning',
      blocking: false,
      entropyDelta: 1,
      couplingDelta: 1,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 88,
      },
    },
    previousArchitect: {
      architectureScore: {
        overallScore: 96,
      },
    },
  });

  assert.equal(result.architectureScoreDelta, -8);
  assert.equal(result.refactorPressure, 'medium');
});
