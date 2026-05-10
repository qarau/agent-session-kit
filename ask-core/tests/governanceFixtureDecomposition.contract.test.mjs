import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const contractsDir = path.resolve(testsDir, '..', 'src', 'contracts');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

test('governance fixtures are decomposed into focused modules with stable re-exports', () => {
  const expectedModules = [
    'governanceCheckFixtures.ts',
    'governanceOhderFixtures.ts',
    'governanceArchitectFixtures.ts',
    'governanceDecisionFixtures.ts',
  ];
  for (const moduleName of expectedModules) {
    assert.equal(fs.existsSync(path.join(contractsDir, moduleName)), true, moduleName);
  }

  const index = readContract('governanceFixtures.ts');
  for (const moduleName of expectedModules) {
    assert.match(index, new RegExp(`export \\* from './${moduleName.replace(/\.ts$/u, '.js')}'`, 'u'));
  }
});

test('legacy governance fixture public symbols remain available from governanceFixtures', () => {
  const index = readContract('governanceFixtures.ts');
  for (const symbol of [
    'askPreCommitCheckResultFixture',
    'askCommitMessageCheckResultFixture',
    'askPrePushCheckResultFixture',
    'askOhderSemanticFactFixture',
    'askOhderFindingResolutionFixture',
    'askOhderFindingFixture',
    'askArchitectValidationResultFixture',
    'askGovernanceDecisionStateFixture',
    'askGovernanceExplainReportFixture',
  ]) {
    assert.match(index, new RegExp(symbol, 'u'));
  }
});
