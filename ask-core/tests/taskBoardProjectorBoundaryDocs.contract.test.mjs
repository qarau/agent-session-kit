import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..', '..');
const statusDocPath = path.join(repoRoot, 'docs', 'operations', 'typescript-migration-status.md');

test('typescript migration status records TaskBoardProjector boundary hardening completion', () => {
  const doc = fs.readFileSync(statusDocPath, 'utf8');

  for (const phrase of [
    'TaskBoardProjector TypeScript Boundary Hardening wave',
    'TaskBoardProjector boundary hardening is complete for this wave',
    'RuntimeProjectionEngine.js still runs as source-compatible JavaScript while task-board projection helpers are typed and mirrored',
    'Plan Batch Registry Runtime Conversion is the next likely wave',
    'contracts first',
    'runtime conversion later',
    'strictness last',
  ]) {
    assert.match(doc, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
});
