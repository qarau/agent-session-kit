import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const projectorsSrcDir = path.join(askCoreRoot, 'src', 'runtime', 'projectors');

function readProjector(fileName) {
  return fs.readFileSync(path.join(projectorsSrcDir, fileName), 'utf8');
}

function listRuntimeSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listRuntimeSourceFiles(fullPath);
    }
    return entry.isFile() && /\.[jt]s$/u.test(entry.name) ? [fullPath] : [];
  });
}

test('TaskBoardProjector TypeScript helper exports typed pure projection helpers', () => {
  const helper = readProjector('TaskBoardProjectorHelpers.ts');

  for (const pattern of [
    /export type AskTaskBoardProjectionEvent/u,
    /export type AskTaskBoardProjectionTask/u,
    /export type AskTaskBoardProjectionState/u,
    /export function normalizeTaskBoardTaskId/u,
    /export function cloneTaskBoardObject/u,
    /export function normalizeAcceptanceCriteria/u,
    /export function createTaskBoardBase/u,
    /export function withTaskBoardTask/u,
    /export function mergeTaskBoardDependencies/u,
  ]) {
    assert.match(helper, pattern);
  }
});

test('source-run runtime files do not import the TypeScript task-board helper directly', () => {
  const sourceFiles = listRuntimeSourceFiles(path.join(askCoreRoot, 'src'))
    .filter(filePath => !filePath.endsWith(`${path.sep}TaskBoardProjectorHelpers.ts`))
    .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('TaskBoardProjectorHelpers.ts'));

  assert.deepEqual(sourceFiles, []);
});
