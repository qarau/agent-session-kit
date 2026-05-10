import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const coreSrcDir = path.join(askCoreRoot, 'src', 'core');
const contractsSrcDir = path.join(askCoreRoot, 'src', 'contracts');

function readCore(fileName) {
  return fs.readFileSync(path.join(coreSrcDir, fileName), 'utf8');
}

function readContract(fileName) {
  return fs.readFileSync(path.join(contractsSrcDir, fileName), 'utf8');
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

test('plan batch registry contract represents current registry artifact shape', () => {
  const tasksContract = readContract('tasks.ts');

  assert.match(tasksContract, /export interface AskPlanBatchRegistry/u);
  assert.match(tasksContract, /export interface AskPlanBatchRegistryRecord/u);
  assert.match(tasksContract, /batches: Record<string, AskPlanBatchRegistryRecord>/u);
  assert.match(tasksContract, /artifactHashes: Record<string, string\[\]>/u);
});

test('PlanBatchRegistry TypeScript helper exports typed pure registry helpers', () => {
  const helper = readCore('PlanBatchRegistryRuntime.ts');

  for (const pattern of [
    /export type AskPlanBatchRegistryDecision/u,
    /export function normalizePlanBatchRegistry/u,
    /export function normalizePlanBatchValue/u,
    /export function buildPlanBatchBase/u,
    /export function mergePlanBatchState/u,
    /export function mergeArtifactHashIndex/u,
    /export function allocatePlanBatchId/u,
  ]) {
    assert.match(helper, pattern);
  }
});

test('source-run runtime files do not import the TypeScript plan-batch helper directly', () => {
  const sourceFiles = listRuntimeSourceFiles(path.join(askCoreRoot, 'src'))
    .filter(filePath => !filePath.endsWith(`${path.sep}PlanBatchRegistryRuntime.ts`))
    .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('PlanBatchRegistryRuntime.ts'));

  assert.deepEqual(sourceFiles, []);
});
