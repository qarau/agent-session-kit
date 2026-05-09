import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const repoRoot = path.resolve(askCoreRoot, '..');

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('implementation begin adapter and docs define the required plan-to-implementation boundary', () => {
  const adapter = readRepoFile('scripts/session/runAskImplementationBeginAdapter.mjs');
  assert.match(adapter, /implementation/);
  assert.match(adapter, /begin/);
  assert.match(adapter, /--plan/);
  assert.match(adapter, /--title/);

  const operationsDoc = readRepoFile('docs/operations/plan-mode-handoff-governance.md');
  assert.match(operationsDoc, /ask implementation begin --plan <md> --title <title>/);
  assert.match(operationsDoc, /Implement the plan/);
  assert.match(operationsDoc, /before editing/);

  const readme = readRepoFile('README.md');
  assert.match(readme, /ask implementation begin --plan <md> --title <title>/);
  assert.match(readme, /ASK Forge = Governance Constitution/);
  assert.match(readme, /Codex = Implementation Engine/);
  assert.match(readme, /Superpowers = Workflow Discipline/);
});
