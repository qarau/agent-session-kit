import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const repoRoot = path.resolve(askCoreRoot, '..');
const coreSrcDir = path.join(askCoreRoot, 'src', 'core');

function readCore(fileName) {
  return fs.readFileSync(path.join(coreSrcDir, fileName), 'utf8');
}

function readSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(fullPath);
    }
    return /\.(js|mjs|ts)$/u.test(entry.name) ? [fullPath] : [];
  });
}

test('SliceCloseRuntime TypeScript helper exports typed pure helper functions', () => {
  const helper = readCore('SliceCloseRuntimeHelpers.ts');
  for (const symbol of [
    'normalizeSliceCloseValue',
    'toSliceCloseBoolean',
    'toSliceCloseNumber',
    'normalizeSliceCloseLower',
    'parseSliceCloseList',
    'riskFromArchitectureScore',
    'entropyDimensionsFromArchitectResult',
    'parseGitStatusPath',
    'resolveSliceCloseSummary',
    'isRefactorGovernedSliceTask',
  ]) {
    assert.match(helper, new RegExp(`export function ${symbol}\\b`, 'u'));
  }
});

test('SliceCloseRuntime TypeScript helper executes current pure helper behavior', () => {
  const script = `
    import assert from 'node:assert/strict';
    const helper = await import('./ask-core/src/core/SliceCloseRuntimeHelpers.ts');
    assert.equal(helper.normalizeSliceCloseValue('  task-1  '), 'task-1');
    assert.equal(helper.toSliceCloseBoolean('yes', false), true);
    assert.equal(helper.toSliceCloseBoolean('off', true), false);
    assert.equal(helper.toSliceCloseBoolean('unknown', true), true);
    assert.equal(helper.toSliceCloseNumber('42', 0), 42);
    assert.equal(helper.toSliceCloseNumber('bad', 7), 7);
    assert.equal(helper.normalizeSliceCloseLower('  MEDIUM  '), 'medium');
    assert.deepEqual(helper.parseSliceCloseList(' A, b ,, C ', [], true), ['a', 'b', 'c']);
    assert.deepEqual(helper.parseSliceCloseList([' A ', '', null, 'B'], [], false), ['A', 'B']);
    assert.equal(helper.riskFromArchitectureScore(69), 'high');
    assert.equal(helper.riskFromArchitectureScore(84), 'medium');
    assert.equal(helper.riskFromArchitectureScore(85), 'low');
    assert.equal(helper.parseGitStatusPath(' M ask-core/src/core/SliceCloseRuntime.js'), 'ask-core/src/core/SliceCloseRuntime.js');
    assert.equal(helper.parseGitStatusPath('?? docs/plans/example.md'), 'docs/plans/example.md');
    assert.equal(helper.resolveSliceCloseSummary({
      taskId: 'task-1',
      lanes: ['integrator', 'protected'],
      fullSuiteResult: { required: true, command: 'npm' }
    }), 'slice close auto-verified after full suite pass for task-1; lanes=integrator,protected; command=npm');
    assert.equal(helper.resolveSliceCloseSummary({
      taskId: 'task-2',
      lanes: [],
      fullSuiteResult: { required: false, command: 'npm' }
    }), 'slice close auto-verified for task-2; lanes=default; full-suite=not-required');
    assert.equal(helper.isRefactorGovernedSliceTask({ taskId: 'feature-1', title: 'Add feature' }), false);
    assert.equal(helper.isRefactorGovernedSliceTask({ taskId: 'ohder-refactor-1', title: 'Reduce entropy' }), true);
    assert.equal(helper.isRefactorGovernedSliceTask({ origin: { type: 'ohder-refactor-governance' } }), true);
    const dimensions = helper.entropyDimensionsFromArchitectResult({
      ohderFacts: { ssot_integrity: 'invalid', durability_integrity: 'at-risk', srp_integrity: 'weak' },
      architectureScore: { categories: { observability: 64 } },
      duplicationAnalysis: { risk: 'medium' },
      refactorOutcome: { status: 'failed' }
    });
    assert.equal(dimensions.ssotViolationCount, 1);
    assert.equal(dimensions.durabilityRisk, 'high');
    assert.equal(dimensions.complexityRisk, 'high');
    assert.equal(dimensions.duplicationRisk, 'medium');
    assert.equal(dimensions.observabilityRisk, 'high');
    assert.equal(dimensions.refactorHealth, 'failed');
  `;

  const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', script], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('source-run runtime files do not import the TypeScript slice-close helper directly', () => {
  const offenders = readSourceFiles(path.join(askCoreRoot, 'src'))
    .filter(filePath => !filePath.endsWith(`${path.sep}SliceCloseRuntimeHelpers.ts`))
    .filter(filePath => fs.readFileSync(filePath, 'utf8').includes('SliceCloseRuntimeHelpers.ts'));

  assert.deepEqual(offenders, []);
});
