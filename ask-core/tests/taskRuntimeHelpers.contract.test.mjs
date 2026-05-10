import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const coreSrcDir = path.join(askCoreRoot, 'src', 'core');

function readCore(fileName) {
  return fs.readFileSync(path.join(coreSrcDir, fileName), 'utf8');
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

test('TaskRuntime TypeScript helper exports typed pure task runtime helpers', () => {
  const helper = readCore('TaskRuntimeHelpers.ts');

  for (const pattern of [
    /export type AskTaskRuntimeFreshness/u,
    /export function normalizeTaskRuntimeValue/u,
    /export function createTaskFreshness/u,
    /export function enrichTaskWithFreshness/u,
    /export function buildTaskCreatedPayload/u,
    /export function buildTaskAssignedPayload/u,
    /export function buildTaskReopenedPayload/u,
    /export function buildTaskDependencyAddedPayload/u,
    /export function okTaskResult/u,
  ]) {
    assert.match(helper, pattern);
  }
});

test('source-run runtime files do not import the TypeScript task helper directly', () => {
  const sourceFiles = listRuntimeSourceFiles(path.join(askCoreRoot, 'src'))
    .filter(filePath => !filePath.endsWith(`${path.sep}TaskRuntimeHelpers.ts`))
    .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('TaskRuntimeHelpers.ts'));

  assert.deepEqual(sourceFiles, []);
});
