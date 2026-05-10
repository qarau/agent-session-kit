import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status records EventLedger runtime compatibility completion', () => {
  const doc = fs.readFileSync(statusDocPath, 'utf8');

  for (const phrase of [
    'EventLedger TypeScript Runtime Conversion wave',
    'EventLedger runtime compatibility conversion is complete for this wave',
    'full source-only .ts runtime loading remains deferred until CLI build/shim strategy is selected',
    'RuntimeSnapshotStore TypeScript Boundary Hardening wave',
    'contracts first',
    'runtime conversion later',
    'strictness last',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});
