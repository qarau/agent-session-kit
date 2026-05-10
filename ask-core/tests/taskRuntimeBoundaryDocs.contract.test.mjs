import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status records TaskRuntime boundary hardening completion', () => {
  const doc = fs.readFileSync(statusDocPath, 'utf8');

  for (const phrase of [
    'TaskRuntime TypeScript Boundary Hardening wave',
    'TaskRuntime boundary hardening is complete for this wave',
    'SliceCloseRuntime was deferred from this TaskRuntime wave because it owns validation, OHDER, auto-commit, rollback, and pre-push behavior',
    'Plan Batch Registry Runtime Conversion',
    'contracts first',
    'runtime conversion later',
    'strictness last',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});
