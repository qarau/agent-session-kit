import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status records RuntimeSnapshotStore boundary hardening completion', () => {
  const doc = fs.readFileSync(statusDocPath, 'utf8');

  for (const phrase of [
    'RuntimeSnapshotStore TypeScript Boundary Hardening wave',
    'snapshot/runtime store boundary hardening is complete for this wave',
    'full source-only .ts runtime loading remains deferred until CLI build/shim strategy is selected',
    'task/slice runtime conversion or CLI build/shim strategy',
    'contracts first',
    'runtime conversion later',
    'strictness last',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});
