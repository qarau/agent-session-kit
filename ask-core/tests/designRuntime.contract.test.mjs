import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { EventLedger } from '../src/runtime/EventLedger.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runOrThrow(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `status=${String(result.status)}`,
        result.stdout,
        result.stderr,
      ].join('\n')
    );
  }
  return result;
}

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-design-runtime-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  return repoDir;
}

function writeRuntimeEvidence(repoDir, touchedFiles, validationStatus = 'passed') {
  const ledger = new EventLedger(repoDir);
  return (async () => {
    await ledger.append({
      type: 'SliceCreated',
      sessionId: 'sess_design',
      taskId: 'deep-012',
      actor: 'local',
      payload: { id: 'slice_design_runtime' },
      meta: { source: 'test' },
    });
    await ledger.append({
      type: 'CodexExecutionCaptured',
      sessionId: 'sess_design',
      taskId: 'deep-012',
      actor: 'local',
      payload: {
        status: 'completed',
        exitCode: 0,
        touchedFiles,
      },
      meta: { source: 'test' },
    });
    await ledger.append({
      type: validationStatus === 'failed' ? 'ValidationFailed' : 'ValidationPassed',
      sessionId: 'sess_design',
      taskId: 'deep-012',
      actor: 'local',
      payload: {
        status: validationStatus,
        testsRun: ['npm run ui-tests'],
        warnings: validationStatus === 'failed' ? ['ui regression'] : [],
        failures: validationStatus === 'failed' ? ['ui regression'] : [],
      },
      meta: { source: 'test' },
    });
  })();
}

test('ask init scaffolds design runtime files and keeps edits on non-reset init', () => {
  const repoDir = setupRepo();
  const designDir = path.join(repoDir, '.ask', 'design');
  const expected = [
    'design-system.md',
    'design-tokens.json',
    'component-patterns.json',
    'modal-contracts.json',
    'visual-regression-map.json',
    'design-history.ndjson',
    'design-metrics.json',
  ];
  for (const fileName of expected) {
    assert.equal(fs.existsSync(path.join(designDir, fileName)), true, `${fileName} should exist`);
  }

  const designDocPath = path.join(designDir, 'design-system.md');
  const custom = '# Design System Memory\n\nCustom content.\n';
  fs.writeFileSync(designDocPath, custom, 'utf8');
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  assert.equal(fs.readFileSync(designDocPath, 'utf8'), custom, 'non-reset init should not overwrite design doc');
});

test('ask design discover --last discovers unmapped regions once then returns noop', async () => {
  const repoDir = setupRepo();
  await writeRuntimeEvidence(repoDir, ['packages/design/HeroPanel.tsx']);

  const first = runOrThrow(process.execPath, [askBinPath, 'design', 'discover', '--last'], { cwd: repoDir });
  const firstPayload = JSON.parse(first.stdout);
  assert.equal(firstPayload.ok, true);
  assert.equal(firstPayload.discovery.status, 'discovered');
  assert.equal(firstPayload.discovery.discoveredCount, 1);

  const second = runOrThrow(process.execPath, [askBinPath, 'design', 'discover', '--last'], { cwd: repoDir });
  const secondPayload = JSON.parse(second.stdout);
  assert.equal(secondPayload.ok, true);
  assert.equal(secondPayload.discovery.status, 'noop');
  assert.equal(secondPayload.discovery.discoveredCount, 0);
});

test('ask design validate --last emits warnings without blocking in warn-only mode', async () => {
  const repoDir = setupRepo();
  const tokensPath = path.join(repoDir, '.ask', 'design', 'design-tokens.json');
  fs.writeFileSync(tokensPath, JSON.stringify({}, null, 2), 'utf8');
  await writeRuntimeEvidence(repoDir, ['src/components/modal/NewFeatureModal.tsx'], 'failed');

  runOrThrow(process.execPath, [askBinPath, 'design', 'discover', '--last'], { cwd: repoDir });
  const validation = runOrThrow(process.execPath, [askBinPath, 'design', 'validate', '--last'], { cwd: repoDir });
  const payload = JSON.parse(validation.stdout);
  assert.equal(payload.ok, true, 'warn-only mode should not fail command');
  assert.equal(payload.design.status, 'warning');
  assert.equal(payload.design.blocking, false);
  assert.equal(Array.isArray(payload.design.warnings), true);
  assert.equal(payload.design.warnings.length > 0, true);

  const status = runOrThrow(process.execPath, [askBinPath, 'design', 'status'], { cwd: repoDir });
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.status, 'warning');
  assert.equal(statusPayload.metrics.visualDriftTrend, 'regressing');

  const listed = runOrThrow(process.execPath, [askBinPath, 'design', 'list'], { cwd: repoDir });
  const listPayload = JSON.parse(listed.stdout);
  assert.equal(typeof listPayload.visualRegionCount, 'number');
  assert.equal(Array.isArray(listPayload.visualRegions), true);
});
