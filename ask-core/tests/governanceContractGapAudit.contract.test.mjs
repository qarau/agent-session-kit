import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const contractsDir = path.join(repoRoot, 'ask-core', 'src', 'contracts');
const fixturesDir = path.join(testsDir, 'fixtures', 'contracts');
const auditDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-governance-contract-gap-audit.md');

function readContract(fileName) {
  return fs.readFileSync(path.join(contractsDir, fileName), 'utf8');
}

function readFixture(fileName) {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, fileName), 'utf8'));
}

test('governance gap audit maps current artifacts to TypeScript contract coverage', () => {
  const governance = readContract('governance.ts');
  const finding = readFixture('ohder-finding.json');
  const resolution = readFixture('ofrr-resolution.json');

  assert.match(governance, /export interface AskOhderFinding\b/u);
  assert.match(governance, /export interface AskOhderFindingResolution\b/u);
  for (const field of Object.keys(finding)) {
    assert.match(governance, new RegExp(`\\b${field}\\??:`, 'u'), `AskOhderFinding should cover ${field}`);
  }
  for (const field of Object.keys(resolution)) {
    assert.match(governance, new RegExp(`\\b${field}\\??:`, 'u'), `AskOhderFindingResolution should cover ${field}`);
  }

  const audit = fs.readFileSync(auditDocPath, 'utf8');
  for (const phrase of [
    'ask-ts-013',
    'ask-ts-014',
    'ask-ts-015',
    'contract-only',
    'runtime-shape drift',
    'missing runtime helper typing',
    'OFRR remains record-only',
    'no blocking behavior change',
  ]) {
    assert.match(audit, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});
