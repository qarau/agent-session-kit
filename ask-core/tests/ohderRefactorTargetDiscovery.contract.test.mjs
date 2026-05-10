import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderRefactorTargetDiscoveryEngine } from '../src/core/OhderRefactorTargetDiscoveryEngine.js';

function discover(input = {}) {
  const engine = new OhderRefactorTargetDiscoveryEngine();
  return engine.discover(input);
}

test('target discovery derives deterministic file targets from pressure history and changed files', () => {
  const first = discover({
    metricsHistory: [
      {
        taskId: 'slice-001',
        entropyDelta: 1,
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
    ],
    changeSets: [
      {
        taskId: 'slice-001',
        files: [
          'ask-core/src/core/OhderNextActionEngine.js',
          'ask-core/src/cli/commands/next.js',
        ],
      },
      {
        taskId: 'slice-002',
        files: [
          'ask-core/src/core/OhderNextActionEngine.js',
          'ask-core/tests/ohderNextAction.contract.test.mjs',
        ],
      },
    ],
  });
  const second = discover({
    metricsHistory: [
      {
        taskId: 'slice-001',
        entropyDelta: 1,
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
    ],
    changeSets: [
      {
        taskId: 'slice-001',
        files: [
          'ask-core/src/core/OhderNextActionEngine.js',
          'ask-core/src/cli/commands/next.js',
        ],
      },
      {
        taskId: 'slice-002',
        files: [
          'ask-core/src/core/OhderNextActionEngine.js',
          'ask-core/tests/ohderNextAction.contract.test.mjs',
        ],
      },
    ],
  });

  assert.equal(first.suppression, null);
  assert.equal(first.target.targetId, 'file:ask-core/src/core/OhderNextActionEngine.js');
  assert.equal(first.target.type, 'file');
  assert.equal(first.target.path, 'ask-core/src/core/OhderNextActionEngine.js');
  assert.deepEqual(first.target.evidence.relatedTasks, ['slice-001', 'slice-002']);
  assert.deepEqual(first, second);
});

test('target discovery skips completed OHDER refactor targets and selects the next candidate', () => {
  const result = discover({
    metricsHistory: [
      {
        taskId: 'slice-001',
        entropyDelta: 1,
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
    ],
    changeSets: [
      {
        taskId: 'slice-001',
        files: ['ask-core/src/core/Hotspot.js', 'ask-core/src/core/Secondary.js'],
      },
      {
        taskId: 'slice-002',
        files: ['ask-core/src/core/Hotspot.js'],
      },
    ],
    tasks: {
      'ohder-refactor-hotspot': {
        status: 'completed',
        origin: {
          type: 'ohder-refactor-governance',
          targetId: 'file:ask-core/src/core/Hotspot.js',
        },
      },
    },
  });

  assert.equal(result.target.targetId, 'file:ask-core/src/core/Secondary.js');
  assert.equal(result.candidates.some(candidate => candidate.targetId === 'file:ask-core/src/core/Hotspot.js'), false);
});

test('target discovery suppresses generic refactors when no concrete target remains', () => {
  const result = discover({
    metricsHistory: [
      {
        taskId: 'slice-001',
        entropyDelta: 0,
        couplingDelta: 0,
        entropyTrend: 'stable',
        refactorPressure: 'none',
      },
    ],
    changeSets: [
      {
        taskId: 'slice-001',
        files: ['ask-core/src/core/Stable.js'],
      },
    ],
  });

  assert.equal(result.target, null);
  assert.equal(result.suppression.reason, 'no-new-refactor-target');
  assert.deepEqual(result.candidates, []);
});
