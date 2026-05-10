import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactEntropy,
  compactRefactorRecommendation,
  resolveRefactorCommand,
} from '../src/core/OhderRuntimeSummaries.js';

test('OHDER runtime summaries compact refactor recommendation deterministically', () => {
  const compact = compactRefactorRecommendation({
    fingerprint: 'abc123',
    title: ' Reduce OHDER entropy pressure ',
    confidence: 'high',
    reason: ' OHDER entropy trend is regressing. ',
    targetSignals: [' entropy.trend:regressing ', '', null],
    target: {
      targetId: ' file:ask-core/src/core/Hotspot.js ',
      type: ' file ',
      path: ' ask-core/src/core/Hotspot.js ',
    },
    ignored: 'field',
  });

  assert.deepEqual(compact, {
    fingerprint: 'abc123',
    title: 'Reduce OHDER entropy pressure',
    confidence: 'high',
    reason: 'OHDER entropy trend is regressing.',
    targetSignals: ['entropy.trend:regressing'],
    target: {
      targetId: 'file:ask-core/src/core/Hotspot.js',
      type: 'file',
      path: 'ask-core/src/core/Hotspot.js',
    },
  });
});

test('OHDER runtime summaries compact entropy deterministically', () => {
  assert.deepEqual(compactEntropy({
    entropyScore: '0.17',
    trend: ' regressing ',
    couplingTrend: ' stable ',
    replayabilityTrend: ' stable ',
    architectureScoreDelta: '0',
    refactorPressure: ' high ',
    ignored: true,
  }), {
    entropyScore: 0.17,
    trend: 'regressing',
    couplingTrend: 'stable',
    replayabilityTrend: 'stable',
    architectureScoreDelta: 0,
    refactorPressure: 'high',
  });
});

test('OHDER runtime summaries resolve refactor command by confidence policy', () => {
  assert.equal(resolveRefactorCommand({ confidence: 'high' }, {}), 'ask refactor preview');
  assert.equal(resolveRefactorCommand({ confidence: 'medium' }, {
    refactor_materialization: {
      auto_materialize_high_confidence: true,
    },
  }), 'ask refactor preview');
  assert.equal(resolveRefactorCommand({ confidence: 'high' }, {
    refactor_materialization: {
      auto_materialize_high_confidence: true,
    },
  }), 'ask refactor create --auto');
});
