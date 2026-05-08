import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approvedRefactorGovernance,
  createdRefactorGovernance,
  rejectedRefactorGovernance,
} from '../src/runtime/projectors/RefactorTaskGovernance.js';

test('createdRefactorGovernance projects refactor task metadata from origin', () => {
  const executionPlan = {
    planId: 'plan-1',
    actions: [
      {
        type: 'split-doc-section',
        targetPath: 'docs/operations/operator-playbooks.md',
      },
    ],
  };

  const result = createdRefactorGovernance({
    type: 'ohder-refactor-governance',
    recommendationFingerprint: 'fingerprint-1',
    targetId: 'file:docs/operations/operator-playbooks.md',
    confidence: 'high',
    approvalRequired: false,
    refactorExecutionPlan: executionPlan,
  });

  assert.deepEqual(result, {
    recommendationFingerprint: 'fingerprint-1',
    targetId: 'file:docs/operations/operator-playbooks.md',
    confidence: 'high',
    approvalRequired: false,
    approvalStatus: 'not-required',
    approvedBy: '',
    rejectedReason: '',
    executionPlan,
  });
});

test('approvedRefactorGovernance clears approval requirement and records approval metadata', () => {
  const result = approvedRefactorGovernance(
    {
      approvalRequired: true,
      approvalStatus: 'pending',
    },
    {
      ts: '2026-05-08T00:00:00.000Z',
      payload: {
        approvedBy: 'architect',
      },
    }
  );

  assert.equal(result.approvalRequired, false);
  assert.equal(result.approvalStatus, 'approved');
  assert.equal(result.approvedBy, 'architect');
  assert.equal(result.approvedAt, '2026-05-08T00:00:00.000Z');
});

test('rejectedRefactorGovernance records rejection metadata without losing existing fields', () => {
  const result = rejectedRefactorGovernance(
    {
      recommendationFingerprint: 'fingerprint-1',
      approvalStatus: 'pending',
    },
    {
      ts: '2026-05-08T00:00:00.000Z',
      payload: {
        reason: 'too risky',
      },
    }
  );

  assert.equal(result.recommendationFingerprint, 'fingerprint-1');
  assert.equal(result.approvalStatus, 'rejected');
  assert.equal(result.rejectedReason, 'too risky');
  assert.equal(result.rejectedAt, '2026-05-08T00:00:00.000Z');
});
