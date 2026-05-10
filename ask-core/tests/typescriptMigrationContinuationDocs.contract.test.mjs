import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status documents the next governed continuation sequence', () => {
  const doc = fs.readFileSync(statusDocPath, 'utf8');

  for (const phrase of [
    'adapter wrapper, project detection, and adapter resolution are already complete',
    'Do not claim full TypeScript runtime migration is complete',
    'contracts first',
    'runtime conversion later',
    'strictness last',
    'ASK ready-plan and slice-close governance remain required',
    'Next Recommended Implementation Sequence',
    'governance runtime decomposition',
    'event ledger runtime conversion',
    'Projection Cursor TypeScript Runtime Boundary wave',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});
