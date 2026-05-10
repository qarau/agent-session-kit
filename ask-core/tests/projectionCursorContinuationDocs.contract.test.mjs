import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status records projection cursor boundary completion and next runtime work', () => {
  const doc = fs.readFileSync(statusDocPath, 'utf8');

  for (const phrase of [
    'Projection Cursor TypeScript Runtime Boundary wave',
    'projection cursor boundary/conversion is complete for this wave',
    'full projection engine TypeScript conversion remains deferred',
    'RuntimeSnapshotStore TypeScript Boundary Hardening wave',
    'task/slice runtime conversion or CLI build/shim strategy',
    'contracts first',
    'runtime conversion later',
    'strictness last',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});
