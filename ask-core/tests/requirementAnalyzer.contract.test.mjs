import assert from 'node:assert/strict';
import test from 'node:test';
import { RequirementAnalyzerEngine } from '../src/core/RequirementAnalyzerEngine.js';
import { IntentEngine } from '../src/core/IntentEngine.js';
import { SlicePlanner } from '../src/core/SlicePlanner.js';

test('requirement analyzer classifies requirement type and risk flags', () => {
  const analysis = new RequirementAnalyzerEngine().analyze({
    requirement: 'Fix auth token migration regression in the event ledger before release',
    touchedFiles: ['ask-core/src/runtime/EventLedger.js'],
  });

  assert.equal(analysis.primaryClass, 'bugfix');
  assert.ok(analysis.classes.includes('bugfix'));
  assert.ok(analysis.classes.includes('release'));
  assert.ok(analysis.classes.includes('security-sensitive'));
  assert.ok(analysis.classes.includes('durability-sensitive'));
  assert.equal(analysis.riskFlags.securitySensitive, true);
  assert.equal(analysis.riskFlags.durabilitySensitive, true);
});

test('intent selection includes requirement analysis', () => {
  const intent = new IntentEngine().select({
    sessionId: 'sess-requirement',
    status: 'active',
    continuityValid: true,
    acceptanceCriteriaMet: false,
    nextRecommendedAction: 'Implement governed security policy docs',
  }, {});

  assert.equal(intent.requirementAnalysis.primaryClass, 'feature');
  assert.ok(intent.requirementAnalysis.classes.includes('governance'));
  assert.equal(intent.requirementAnalysis.riskFlags.securitySensitive, true);
});

test('slice planner persists requirement class and risk flags in metadata', () => {
  const intent = new IntentEngine().select({
    sessionId: 'sess-requirement-slice',
    status: 'active',
    continuityValid: true,
    nextRecommendedAction: 'Refactor snapshot projection persistence',
  }, {});
  const planned = new SlicePlanner().create(intent, {
    sessionId: 'sess-requirement-slice',
    nextRecommendedAction: 'Refactor snapshot projection persistence',
  });

  assert.equal(planned.ok, true);
  assert.equal(planned.slice.metadata.requirementAnalysis.primaryClass, 'refactor');
  assert.equal(planned.slice.metadata.requirementAnalysis.riskFlags.durabilitySensitive, true);
});
