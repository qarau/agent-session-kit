import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('semantic autonomy docs explain current runtime and future patch boundary', () => {
  const readme = read('README.md');
  const architecture = read('docs/operations/runtime-architecture.md');
  const policy = read('docs/operations/policy-reference.md');
  const playbook = read('docs/operations/operator-playbooks.md');
  const analyzer = read('docs/operations/ohder-analyzer-playbook.md');
  const future = read('docs/operations/future-ohder-runtime.md');
  const release = read('docs/releases/v5.1.0.md');

  for (const required of [
    'Current release line: `v5.1.0`',
    'OHDER Semantic Autonomy',
    'semanticFacts',
    'ask governance validate',
    'targetPortfolio',
    'OhderPatchReadinessGate',
    'council-lite',
  ]) {
    assert.match(readme, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  assert.match(architecture, /GovernanceValidationCompleted/u);
  assert.match(architecture, /architectureReview/u);
  assert.match(policy, /ohder_autonomy/u);
  assert.match(playbook, /governance validate/u);
  assert.match(analyzer, /semantic fact/u);
  assert.match(future, /patchExecutionAllowed: false/u);
  assert.match(release, /v5\.1\.0/u);
  assert.match(release, /semantic autonomy/u);
  assert.match(release, /does not apply patches automatically/u);
});
