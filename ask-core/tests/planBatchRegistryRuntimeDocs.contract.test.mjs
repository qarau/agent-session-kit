import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status records Plan Batch Registry runtime conversion completion', () => {
  const statusDoc = fs.readFileSync(statusDocPath, 'utf8');
  for (const expected of [
    'Plan Batch Registry TypeScript Runtime Conversion Wave',
    'Plan Batch Registry Runtime Conversion is complete for this wave',
    '`PlanIngestRuntime.js` remains source-compatible JavaScript while plan-batch registry helpers are typed and mirrored',
    '`PlanBatchRegistryRuntime.ts` provides the typed helper boundary',
    '`SliceCloseRuntime boundary` is the next likely wave',
    'contracts first',
    'runtime conversion later',
    'strictness last',
  ]) {
    assert.match(statusDoc, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'));
  }
});
