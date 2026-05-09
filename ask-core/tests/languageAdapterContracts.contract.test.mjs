import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const contractsDir = path.join(askCoreRoot, 'src', 'contracts');
const repoRoot = path.resolve(askCoreRoot, '..');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

test('language adapter contracts are exported from the v6 contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /adapter\.js/u);
  assert.match(index, /adapterFixtures\.js/u);

  const adapter = readContract('adapter.ts');
  for (const symbol of [
    'AskLanguageAdapter',
    'AskLanguageAdapterCapability',
    'AskLanguageAdapterContext',
    'AskLanguageAdapterResult',
    'AskLanguageAdapterInspectionResult',
    'AskChangedFileTestMapping',
  ]) {
    assert.match(adapter, new RegExp(`export (type|interface) ${symbol}`, 'u'));
  }

  for (const capability of ['install', 'format', 'lint', 'typecheck', 'test', 'build', 'detect', 'mapChangedFilesToTests', 'inspectArchitecture']) {
    assert.match(adapter, new RegExp(`'${capability}'`, 'u'));
  }
});

test('language adapter fixtures describe skipped optional capabilities', () => {
  const fixture = readContract('adapterFixtures.ts');
  assert.match(fixture, /satisfies AskLanguageAdapter/u);
  assert.match(fixture, /status: 'skipped'/u);
  assert.match(fixture, /status: 'unavailable'/u);
});

test('language adapter slice does not add non-node runtime adapters yet', () => {
  const adapterDir = path.join(repoRoot, 'ask-core', 'src', 'adapters');
  const entries = fs.readdirSync(adapterDir, { recursive: true })
    .map(entry => String(entry).replace(/\\/gu, '/').toLowerCase());
  const forbidden = ['python', 'php', 'dotnet', 'java', 'cpp', 'c++', 'golang', 'rust'];
  for (const entry of entries) {
    for (const language of forbidden) {
      assert.equal(entry.includes(language), false, `${entry} unexpectedly implements ${language}`);
    }
  }
});
