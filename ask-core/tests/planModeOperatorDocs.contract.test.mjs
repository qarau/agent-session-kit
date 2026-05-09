import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('plan-mode handoff operator docs cover governed lifecycle commands and roles', () => {
  const doc = readRepoFile('docs/operations/plan-mode-handoff-governance.md');
  for (const required of [
    'ASK Forge = Governance Constitution',
    'Codex = Implementation Engine',
    'Superpowers = Workflow Discipline',
    'ask plan-mode handoff',
    'ask plan validate',
    'ask plan ingest',
    'ask next',
    'ask task start',
    'ask implementation preflight',
    'ask slice close',
    'ASK-Slice:',
  ]) {
    assert.ok(doc.includes(required), `${required} missing`);
  }

  const readme = readRepoFile('README.md');
  assert.ok(readme.includes('docs/operations/plan-mode-handoff-governance.md'));
  assert.ok(readme.includes('ask plan-mode handoff'));
});

test('plan-mode handoff docs define canonical approved-plan ingestion flow', () => {
  const doc = readRepoFile('docs/operations/plan-mode-handoff-governance.md');
  for (const required of [
    'approved plan is the canonical source',
    'Do not regenerate or rewrite the approved plan',
    'YAGNI',
    'final plan',
    'ask implementation begin',
    'ready-plan commit',
    'handoff',
    'governed slice execution',
    '## Slice N: Title',
    '## Slices',
    '### Title',
    'plan-slice-extraction-ambiguous',
  ]) {
    assert.ok(doc.includes(required), `${required} missing`);
  }

  const readme = readRepoFile('README.md');
  assert.ok(readme.includes('approved plan is the canonical source'));
  assert.ok(readme.includes('Do not regenerate or rewrite the approved plan'));
});
