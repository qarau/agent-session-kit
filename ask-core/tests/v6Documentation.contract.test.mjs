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

test('README frames ASK Forge v6 as the TypeScript contract foundation for language agnostic governance', () => {
  const readme = readRepoFile('README.md');
  assert.match(readme, /ASK Forge v6/u);
  assert.match(readme, /TypeScript contracts/u);
  assert.match(readme, /language-agnostic ASK Forge/u);
  assert.match(readme, /Node\/JavaScript remains the first supported adapter target/u);
  assert.match(readme, /non-Node adapters do not exist yet/u);
});

test('operations docs distinguish v5.1 OHDER semantic autonomy from v6 contract foundation', () => {
  const architecture = readRepoFile('docs/operations/runtime-architecture.md');
  const future = readRepoFile('docs/operations/future-ohder-runtime.md');
  assert.match(architecture, /v5\.1 OHDER semantic autonomy/u);
  assert.match(architecture, /v6 contract foundation/u);
  assert.match(future, /v6 foundation contracts/u);
});

test('v6 release note draft exists and explains the shift from 5.1', () => {
  const release = readRepoFile('docs/releases/v6.0.0.md');
  assert.match(release, /# ASK Forge v6\.0\.0/u);
  assert.match(release, /From v5\.1 to v6\.0\.0/u);
  assert.match(release, /language-agnostic/u);
  assert.match(release, /Node\/JavaScript remains first/u);
});
