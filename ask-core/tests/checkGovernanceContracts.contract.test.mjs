import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const contractsDir = path.join(askCoreRoot, 'src', 'contracts');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

test('check and governance contracts are exported from the v6 contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /checks\.js/u);
  assert.match(index, /governance\.js/u);
  assert.match(index, /governanceFixtures\.js/u);

  const checks = readContract('checks.ts');
  for (const symbol of [
    'AskCheckResult',
    'AskPreCommitCheckResult',
    'AskCommitMessageCheckResult',
    'AskPrePushCheckResult',
    'AskCommitGovernanceResult',
  ]) {
    assert.match(checks, new RegExp(`export (type|interface) ${symbol}`, 'u'));
  }

  const governance = readContract('governance.ts');
  for (const symbol of [
    'AskOhderSemanticFact',
    'AskOhderFinding',
    'AskOhderFindingResolution',
    'AskArchitectValidationResult',
    'AskArchitectureScore',
    'AskGovernanceDecisionState',
  ]) {
    assert.match(governance, new RegExp(`export (type|interface) ${symbol}`, 'u'));
  }
});

test('check and governance fixtures are included in TypeScript compilation', () => {
  const fixture = [
    readContract('governanceFixtures.ts'),
    readContract('governanceCheckFixtures.ts'),
    readContract('governanceOhderFixtures.ts'),
    readContract('governanceArchitectFixtures.ts'),
    readContract('governanceDecisionFixtures.ts'),
  ].join('\n');
  assert.match(fixture, /satisfies AskPreCommitCheckResult/u);
  assert.match(fixture, /satisfies AskCommitMessageCheckResult/u);
  assert.match(fixture, /satisfies AskPrePushCheckResult/u);
  assert.match(fixture, /satisfies AskArchitectValidationResult/u);
  assert.match(fixture, /satisfies AskOhderFinding/u);
  assert.match(fixture, /satisfies AskOhderFindingResolution/u);
});
