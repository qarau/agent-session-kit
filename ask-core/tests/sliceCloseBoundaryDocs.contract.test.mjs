import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status records SliceCloseRuntime boundary hardening completion', () => {
  const statusDoc = fs.readFileSync(statusDocPath, 'utf8');
  for (const expected of [
    'SliceCloseRuntime TypeScript Boundary Hardening Wave',
    'SliceCloseRuntime boundary hardening is complete for this wave',
    '`SliceCloseRuntime.js` remains source-compatible JavaScript while pure helpers are typed and mirrored',
    '`SliceCloseRuntimeHelpers.ts` provides the typed helper boundary',
    '`SliceCloseRuntimeHelpers.js` provides the source-compatible helper mirror',
    'Law-pack and profile runtime conversion is the next likely wave',
    'contracts first',
    'runtime conversion later',
    'strictness last',
  ]) {
    assert.match(statusDoc, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
});
