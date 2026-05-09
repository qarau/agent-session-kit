import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const repoRoot = path.resolve(askCoreRoot, '..');
const contractsDir = path.join(askCoreRoot, 'src', 'contracts');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('project profile and law-pack contracts are exported from the v6 contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /profiles\.js/u);
  assert.match(index, /lawPacks\.js/u);
  assert.match(index, /profileLawFixtures\.js/u);

  const profiles = readContract('profiles.ts');
  for (const symbol of [
    'AskProjectProfile',
    'AskProjectLanguageProfile',
    'AskProjectFrameworkProfile',
    'AskProjectGovernanceGate',
  ]) {
    assert.match(profiles, new RegExp(`export (type|interface) ${symbol}`, 'u'));
  }

  const laws = readContract('lawPacks.ts');
  for (const symbol of [
    'AskOhderLawPack',
    'AskOhderLaw',
    'AskOhderLawSeverity',
    'AskOhderLawScope',
    'AskOhderLawExemption',
  ]) {
    assert.match(laws, new RegExp(`export (type|interface) ${symbol}`, 'u'));
  }
});

test('project profile and law-pack fixtures are included in TypeScript compilation', () => {
  const fixture = readContract('profileLawFixtures.ts');
  assert.match(fixture, /satisfies AskProjectProfile/u);
  assert.match(fixture, /satisfies AskOhderLawPack/u);
  assert.match(fixture, /node-typescript/u);
  assert.match(fixture, /enabled: true/u);
});

test('docs define profile and law contracts as v6 foundation, not active adapters', () => {
  const doc = readRepoFile('docs/operations/future-ohder-runtime.md');
  assert.match(doc, /v6 foundation contracts/u);
  assert.match(doc, /not active multi-language adapter implementations/u);
});
