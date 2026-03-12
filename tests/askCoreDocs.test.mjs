import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('docs describe ask-core runtime and adapter proof flow', () => {
  const readme = read('README.md');
  const howItWorks = read('docs/how-it-works.md');
  const maintainerMode = read('docs/maintainer-mode.md');

  assert.match(readme, /ask-core/i);
  assert.match(howItWorks, /ask-core/i);
  assert.match(maintainerMode, /adapter/i);
  assert.match(maintainerMode, /pre-commit/i);
  assert.match(readme, /session (pause|resume|block|close)/i);
  assert.match(howItWorks, /history\.ndjson/i);
  assert.match(maintainerMode, /pending-transition\.json/i);
  assert.match(readme, /active.*paused/i);
  assert.match(readme, /blocked.*closed/i);
  assert.match(howItWorks, /preflight/i);
  assert.match(howItWorks, /can-commit/i);
  assert.match(maintainerMode, /allowed_(preflight|can_commit)_states/i);
  assert.match(readme, /pre-commit-check/i);
  assert.match(howItWorks, /pre-commit.*ask-core-only/i);
  assert.doesNotMatch(maintainerMode, /pre-push.*hybrid/i);
});

test('package scripts expose ask-core bootstrap and tests', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(typeof pkg.scripts['bootstrap:ask-core'], 'string');
  assert.equal(typeof pkg.scripts['test:ask-core'], 'string');
});
