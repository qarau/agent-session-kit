import assert from 'node:assert/strict';
import test from 'node:test';
import { RefactorGovernanceEngine } from '../src/core/RefactorGovernanceEngine.js';

test('refactor governance triggers on architect/behavior replay failures and recommends retry', () => {
  const engine = new RefactorGovernanceEngine();
  const trigger = engine.evaluate({
    architect: {
      status: 'failed',
      reason: 'entropy budget exceeded',
      entropyDelta: 5,
      couplingDelta: 3,
      lawOutcome: 'retry',
    },
    flow: {
      behaviorReplay: {
        status: 'failed',
      },
      hardFlowViolations: [{ flowId: 'checkout' }],
    },
    slice: {
      title: 'Checkout refactor',
    },
    policy: {
      refactor_governance: {
        enabled: true,
        trigger_on_architect_failed: true,
        trigger_on_flow_replay_failed: true,
      },
      architect: {
        max_entropy_delta: 3,
        max_coupling_delta: 2,
      },
    },
  });

  assert.equal(trigger.required, true);
  assert.equal(trigger.status, 'triggered');
  assert.equal(typeof trigger.reason, 'string');
  assert.equal(trigger.reason.length > 0, true);
  assert.equal(trigger.severity, 'high');
  assert.equal(typeof trigger.hint?.title, 'string');

  const revalidation = engine.revalidate({
    architect: { status: 'failed' },
    flow: { behaviorReplay: { status: 'failed' } },
    trigger,
    policy: {
      refactor_governance: {
        enabled: true,
        block_on_revalidation_failure: false,
      },
    },
  });
  assert.equal(revalidation.status, 'failed');
  assert.equal(revalidation.blocking, false);
});

test('refactor governance can hard-block when configured and revalidation fails', () => {
  const engine = new RefactorGovernanceEngine();
  const trigger = engine.evaluate({
    architect: { status: 'failed', reason: 'law violation' },
    flow: { behaviorReplay: { status: 'passed' }, hardFlowViolations: [] },
    slice: { title: 'Slice X' },
    policy: {
      refactor_governance: {
        enabled: true,
      },
      architect: {
        max_entropy_delta: 3,
        max_coupling_delta: 2,
      },
    },
  });
  const revalidation = engine.revalidate({
    architect: { status: 'failed' },
    flow: { behaviorReplay: { status: 'passed' } },
    trigger,
    policy: {
      refactor_governance: {
        enabled: true,
        block_on_revalidation_failure: true,
      },
    },
  });

  assert.equal(trigger.required, true);
  assert.equal(revalidation.status, 'failed');
  assert.equal(revalidation.blocking, true);
});
