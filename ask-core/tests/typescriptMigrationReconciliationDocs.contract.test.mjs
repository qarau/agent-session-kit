import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

function readStatusDoc() {
  return fs.readFileSync(statusDocPath, 'utf8');
}

test('typescript migration status reconciles completed foundation and adapter slices', () => {
  const doc = readStatusDoc();
  for (const required of [
    'ask-ts-001 through ask-ts-010',
    'completed by the v6 TypeScript contract foundation',
    'ask-ts-011',
    'ask-ts-012',
    'ask-adapter-002',
    'ask-adapter-003',
    'ask-adapter-004',
    'do not duplicate',
    'governance/OFRR runtime typing',
    'not adapter detection duplication',
  ]) {
    assert.ok(doc.includes(required), `${required} missing`);
  }
});
