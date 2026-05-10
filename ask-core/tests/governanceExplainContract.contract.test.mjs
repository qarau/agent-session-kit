import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const contractsDir = path.join(askCoreRoot, 'src', 'contracts');
const fixturePath = path.join(testsDir, 'fixtures', 'contracts', 'governance-explain-report.json');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

test('governance explain report has a stable additive contract fixture', () => {
  const report = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  for (const field of ['ok', 'sessionId', 'ohderMode', 'explanation']) {
    assert.ok(Object.hasOwn(report, field), `missing top-level field: ${field}`);
  }

  const explanation = report.explanation;
  for (const field of [
    'decision',
    'blocking',
    'reasons',
    'unresolvedBlockingFindings',
    'recentSuppressions',
    'analyzerHealthWarnings',
    'recommendedActions',
  ]) {
    assert.ok(Object.hasOwn(explanation, field), `missing explanation field: ${field}`);
  }

  assert.equal(typeof report.ok, 'boolean');
  assert.equal(typeof report.sessionId, 'string');
  assert.equal(typeof report.ohderMode, 'string');
  assert.equal(Array.isArray(explanation.unresolvedBlockingFindings), true);
  assert.equal(Array.isArray(explanation.recentSuppressions), true);
  assert.equal(Array.isArray(explanation.analyzerHealthWarnings), true);
  assert.equal(Array.isArray(explanation.recommendedActions), true);
});

test('governance explain report is exported from the TypeScript contract layer', () => {
  const governance = readContract('governance.ts');
  assert.match(governance, /export interface AskGovernanceExplainReport\b/u);
  assert.match(governance, /export interface AskGovernanceExplainDetails\b/u);

  const fixtures = [
    readContract('governanceFixtures.ts'),
    readContract('governanceDecisionFixtures.ts'),
  ].join('\n');
  assert.match(fixtures, /askGovernanceExplainReportFixture/u);
  assert.match(fixtures, /satisfies AskGovernanceExplainReport/u);
});
