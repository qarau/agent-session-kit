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
  assert.equal(decision.recommendedCommand, 'ask refactor preview');
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

test('OHDER next action creates refactor slice for high entropy pressure', () => {
  const decision = decide({
    architect: {
      status: 'warning',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 91,
      },
    },
    entropy: {
      refactorPressure: 'high',
      trend: 'stable',
      entropyScore: 0.42,
    },
  });

  assert.equal(decision.action, 'create-refactor-slice');
  assert.match(decision.reason, /entropy/i);
  assert.equal(decision.entropy.refactorPressure, 'high');
  assert.equal(decision.recommendedCommand, 'ask refactor preview');
});

test('OHDER next action creates refactor slice for regressing entropy trend', () => {
  const decision = decide({
    architect: {
      status: 'passed',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 98,
      },
    },
    entropy: {
      refactorPressure: 'none',
      trend: 'regressing',
      entropyScore: 0.18,
    },
  });

  assert.equal(decision.action, 'create-refactor-slice');
  assert.match(decision.reason, /regressing/i);
  assert.equal(decision.entropy.trend, 'regressing');
});

test('OHDER next action requests governance validation for medium entropy pressure', () => {
  const decision = decide({
    architect: {
      status: 'warning',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 94,
      },
    },
    entropy: {
      refactorPressure: 'medium',
      trend: 'stable',
      entropyScore: 0.21,
    },
  });

  assert.equal(decision.action, 'run-governance-validation');
  assert.match(decision.reason, /entropy/i);
  assert.equal(decision.entropy.refactorPressure, 'medium');
  assert.equal(decision.recommendedCommand, 'ask governance status');
});


test('OHDER next action includes concrete refactor materialization command and summary', () => {
  const decision = decide({
    architect: {
      status: 'passed',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 98,
      },
    },
    entropy: {
      refactorPressure: 'high',
      trend: 'regressing',
      entropyScore: 0.3,
    },
    refactorRecommendation: {
      fingerprint: 'abc123',
      title: 'Reduce OHDER entropy pressure',
      confidence: 'high',
      reason: 'OHDER entropy trend is regressing.',
      targetSignals: ['entropy.trend:regressing'],
    },
  });

  assert.equal(decision.action, 'create-refactor-slice');
  assert.equal(decision.recommendedCommand, 'ask refactor preview');
  assert.equal(decision.refactorRecommendation.fingerprint, 'abc123');
  assert.equal(decision.refactorRecommendation.confidence, 'high');
});

test('OHDER next action uses automatic refactor command only when policy allows it', () => {
  const decision = decide({
    entropy: {
      refactorPressure: 'high',
      trend: 'regressing',
    },
    refactorRecommendation: {
      fingerprint: 'abc123',
      title: 'Reduce OHDER entropy pressure',
      confidence: 'high',
    },
    policy: {
      refactor_materialization: {
        auto_materialize_high_confidence: true,
      },
    },
  });

  assert.equal(decision.recommendedCommand, 'ask refactor create --auto');
});

