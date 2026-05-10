import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(thisFilePath), '..', '..');

function readRepoFile(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

test('OHDER future runtime docs label capability maturity and prerequisites', () => {
  const futureDoc = readRepoFile('docs/operations/future-ohder-runtime.md');
  const readme = readRepoFile('README.md');
  const operationsIndex = readRepoFile('docs/operations/README.md');

  for (const label of ['Current', 'Partial', 'Planned', 'Future']) {
    assert.match(futureDoc, new RegExp(`## ${label}`, 'u'));
  }

  assert.match(futureDoc, /Implementation prerequisites/u);
  assert.match(futureDoc, /IDEA-aware runtime/u);
  assert.match(futureDoc, /Architectural councils/u);
  assert.match(futureDoc, /Autonomous entropy reduction/u);
  assert.match(futureDoc, /High-confidence autonomous patch application/u);
  assert.match(futureDoc, /Current.*OHDER.*implemented/isu);
  assert.match(readme, /security boundary/u);
  assert.match(readme, /future-ohder-runtime\.md/u);
  assert.match(operationsIndex, /future-ohder-runtime\.md/u);
});
