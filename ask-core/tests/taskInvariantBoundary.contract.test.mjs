import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const invariantsDir = path.join(askCoreRoot, 'src', 'runtime', 'invariants');

function readInvariant(fileName) {
  return fs.readFileSync(path.join(invariantsDir, fileName), 'utf8');
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

test('task invariant TypeScript boundary exports current validation helpers and decision types', () => {
  const helper = readInvariant('taskInvariantHelpers.ts');

  for (const pattern of [
    /export type AskTaskInvariantDecision/u,
    /export type AskTaskInvariantTask/u,
    /export function validateTaskCreate/u,
    /export function validateTaskAssign/u,
    /export function validateTaskStart/u,
    /export function validateTaskComplete/u,
    /export function validateTaskReopen/u,
    /export function validateTaskDepends/u,
  ]) {
    assert.match(helper, pattern);
  }
});

test('source-run runtime files do not import the TypeScript task invariant helper directly', () => {
  const sourceFiles = listRuntimeSourceFiles(path.join(askCoreRoot, 'src'))
    .filter(filePath => !filePath.endsWith(`${path.sep}taskInvariantHelpers.ts`))
    .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('taskInvariantHelpers.ts'));

  assert.deepEqual(sourceFiles, []);
});

test('source-compatible task invariants preserve current validation error codes', async () => {
  const invariants = await import('../src/runtime/invariants/taskInvariants.js');
  assert.equal(invariants.validateTaskCreate({ taskId: '', title: 'Title', existing: null }).code, 'missing-task-id');
  assert.equal(invariants.validateTaskCreate({ taskId: 'task-1', title: '', existing: null }).code, 'missing-title');
  assert.equal(invariants.validateTaskStart({ taskId: 'task-1', task: { status: 'completed' } }).code, 'invalid-task-transition');
  assert.equal(invariants.validateTaskComplete({ taskId: 'task-1', task: { status: 'created' } }).code, 'invalid-task-transition');
  assert.equal(invariants.validateTaskReopen({ taskId: 'task-1', task: { status: 'created' } }).code, 'invalid-task-transition');
  assert.equal(
    invariants.validateTaskDepends({
      taskId: 'task-1',
      dependencyTaskId: 'task-1',
      task: { dependencies: [] },
      dependencyTask: { dependencies: [] },
    }).code,
    'invalid-task-dependency'
  );
});
