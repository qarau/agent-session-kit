import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderDurabilityValidatorEngine } from '../src/core/OhderDurabilityValidatorEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

test('durability validator keeps ordinary docs low risk', () => {
  const engine = new OhderDurabilityValidatorEngine();

  const result = engine.analyze({
    touchedFiles: ['docs/operations/runtime-architecture.md'],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.durabilityDelta, 0);
  assert.deepEqual(result.touchpoints, []);
});

test('durability validator raises risk for projector and snapshot touchpoints', () => {
  const engine = new OhderDurabilityValidatorEngine();

  const result = engine.analyze({
    touchedFiles: [
      'ask-core/src/runtime/projectors/TaskBoardProjector.js',
      'ask-core/src/core/OhderEntropySnapshotEngine.js',
    ],
  });

  assert.equal(result.risk, 'medium');
  assert.equal(result.durabilityDelta >= 4, true);
  assert.equal(result.touchpoints.some(item => item.kind === 'projector'), true);
  assert.equal(result.touchpoints.some(item => item.kind === 'snapshot'), true);
  assert.match(result.findings.join('\n'), /projector durability touchpoint/u);
  assert.match(result.findings.join('\n'), /snapshot durability touchpoint/u);
});

test('architect runtime exposes durability analysis and score penalty', async () => {
  const runtime = new ArchitectRuntime(process.cwd());

  const status = await runtime.assess({
    state: {
      sessionId: 'sess-durability',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-durability',
      execution: {
        operation: 'durability-test',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles: ['ask-core/src/runtime/projectors/TaskBoardProjector.js'],
    },
    validation: {
      status: 'passed',
      testsRun: ['node --test'],
    },
    policy: {
      architect: {
        block_on_violation: false,
      },
    },
  });

  assert.equal(status.durabilityAnalysis.touchpoints.length, 1);
  assert.equal(status.durabilityAnalysis.risk, 'medium');
  assert.equal(status.architectureScore.categories.durability < 100, true);
});
