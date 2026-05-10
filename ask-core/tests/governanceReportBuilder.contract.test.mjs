import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGovernanceExplainReport,
  buildGovernanceStatusReport,
} from '../src/core/GovernanceReportBuilder.js';

test('governance report builder preserves status report public field names', () => {
  const state = {
    sessionId: 'sess-builder',
    status: 'active',
    nextRecommendedAction: 'ask next',
    ohderMode: 'fast',
    continuityValid: true,
    dirtyWorktree: false,
    architect: { status: 'passed' },
    flow: { status: 'clear' },
    loop: { status: 'completed' },
    governanceDecision: { decision: 'continue' },
    ohderFindings: { version: 1, findings: {} },
  };

  const report = buildGovernanceStatusReport(state);

  assert.deepEqual(Object.keys(report), [
    'ok',
    'sessionId',
    'runtimeStatus',
    'nextRecommendedAction',
    'ohderMode',
    'continuityValid',
    'dirtyWorktree',
    'architect',
    'flow',
    'loop',
    'governanceDecision',
    'ohderFindings',
  ]);
  assert.equal(report.ok, true);
  assert.equal(report.sessionId, 'sess-builder');
  assert.equal(report.runtimeStatus, 'active');
});

test('governance report builder preserves explain report public field names', () => {
  const state = {
    sessionId: 'sess-builder',
    ohderMode: 'strict',
    loop: {
      loopId: 'loop-builder',
      status: 'completed',
      decision: 'continue',
      history: [
        {
          index: 1,
          name: 'hydrate_runtime_state',
          details: { status: 'completed' },
        },
      ],
    },
    governanceDecision: {
      decision: 'continue',
      reason: 'governance clear',
      recommendedCommand: 'ask next',
    },
    ohderFindings: {
      findings: {
        one: {
          id: 'ohder-finding-one',
          status: 'open',
          severity: 'critical',
          confidence: 'high',
          metric: 'security_boundary',
          analyzerId: 'OhderSecurityBoundaryAnalyzerEngine',
          lawId: '',
          blocking: true,
          resolution: null,
        },
      },
    },
  };

  const report = buildGovernanceExplainReport(state);

  assert.deepEqual(Object.keys(report), ['ok', 'sessionId', 'ohderMode', 'explanation']);
  assert.equal(report.ok, true);
  assert.equal(report.ohderMode, 'strict');
  assert.equal(report.explanation.decision, 'continue');
  assert.equal(report.explanation.unresolvedBlockingFindings.length, 1);
  assert.deepEqual(report.explanation.recommendedActions, ['ask next', 'ask architect finding list']);
  assert.equal(Array.isArray(report.explanation.steps), true);
});
