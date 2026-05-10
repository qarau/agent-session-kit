import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildGovernanceExplainReport } from '../src/core/GovernanceReportBuilder.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const contractsDir = path.resolve(testsDir, '..', 'src', 'contracts');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

test('governance report builder boundary is exported from TypeScript contracts', () => {
  const index = readContract('index.ts');
  assert.match(index, /governanceReportBuilder\.js/u);

  const boundary = readContract('governanceReportBuilder.ts');
  for (const symbol of [
    'AskGovernanceReportBuilderState',
    'AskGovernanceStatusReport',
    'AskGovernanceReportBuilderOutput',
    'AskGovernanceReportBuilderFixture',
  ]) {
    assert.match(boundary, new RegExp(`export (interface|type|const) ${symbol}\\b`, 'u'));
  }
});

test('javascript governance report helper output matches the explain report contract shape', () => {
  const report = buildGovernanceExplainReport({
    sessionId: 'sess-ts-boundary',
    ohderMode: 'fast',
    governanceDecision: {
      decision: 'continue',
      reason: 'contract boundary clear',
      recommendedCommand: 'ask next',
    },
    loop: {
      status: 'completed',
      history: [],
    },
    ohderFindings: { version: 1, findings: {} },
  });

  assert.equal(report.ok, true);
  assert.equal(typeof report.sessionId, 'string');
  assert.equal(typeof report.ohderMode, 'string');
  assert.equal(typeof report.explanation.decision, 'string');
  assert.equal(typeof report.explanation.blocking, 'boolean');
  assert.equal(Array.isArray(report.explanation.recommendedActions), true);
  assert.equal(Array.isArray(report.explanation.steps), true);
});
