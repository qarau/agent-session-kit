import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status records governance ledger wave completion and next projection work', () => {
  const doc = fs.readFileSync(statusDocPath, 'utf8');

  for (const phrase of [
    'Governance + Event Ledger TypeScript Boundary wave',
    'governance report helper extraction is complete',
    'governance fixture decomposition is complete',
    'EventLedger boundary hardening is complete',
    'EventLedger runtime guard tests are complete',
    'projection cursor runtime conversion is next and still deferred',
    'contracts first',
    'runtime conversion later',
    'strictness last',
    'ASK ready-plan and slice-close governance remain required',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});
