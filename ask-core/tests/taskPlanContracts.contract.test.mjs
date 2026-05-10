import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const repoRoot = path.resolve(askCoreRoot, '..');
const contractsDir = path.join(askCoreRoot, 'src', 'contracts');

function readContract(relativePath) {
  return fs.readFileSync(path.join(contractsDir, relativePath), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('task and plan contracts are exported from the v6 contract layer', () => {
  const index = readContract('index.ts');
  assert.match(index, /tasks\.js/u);
  assert.match(index, /taskPlanFixtures\.js/u);

  const tasks = readContract('tasks.ts');
  for (const symbol of [
    'AskTaskStatus',
    'AskTaskRecord',
    'AskPlanV2',
    'AskPlanSliceInput',
    'AskPlanIngestOrigin',
    'AskMaterializedPlanSlice',
    'AskPlanBatchRecord',
  ]) {
    assert.match(tasks, new RegExp(`export (type|interface) ${symbol}`, 'u'));
  }
});

test('task and plan fixtures are included in TypeScript compilation', () => {
  const fixture = readContract('taskPlanFixtures.ts');
  assert.match(fixture, /satisfies AskPlanV2/u);
  assert.match(fixture, /satisfies AskTaskRecord/u);
  assert.match(fixture, /satisfies AskPlanBatchRecord/u);
});

test('existing plan json artifacts keep the v2 plan input shape', () => {
  const planFiles = fs.readdirSync(path.join(repoRoot, 'docs', 'plans'))
    .filter(fileName => fileName.endsWith('.plan.json'));
  assert.equal(planFiles.length > 0, true);

  for (const fileName of planFiles) {
    const plan = readJson(path.join(repoRoot, 'docs', 'plans', fileName));
    assert.equal(plan.schemaVersion, 2, fileName);
    assert.equal(typeof plan.planPrefix, 'string', fileName);
    assert.equal(typeof plan.planTitle, 'string', fileName);
    assert.equal(Array.isArray(plan.slices), true, fileName);
    assert.equal(plan.slices.length > 0, true, fileName);
  }
});
