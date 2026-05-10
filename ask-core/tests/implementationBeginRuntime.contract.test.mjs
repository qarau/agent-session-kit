import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
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
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      `status=${String(result.status)}`,
      result.stdout,
      result.stderr,
    ].join('\n'));
  }
  return result;
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-implementation-begin-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  return repoDir;
}

test('implementation begin prepares artifacts hands them to ASK and returns next task start', () => {
  const repoDir = setupRepo();
  writeText(path.join(repoDir, 'raw-plan.md'), [
    '# Runtime Begin Plan',
    '',
    '## Slice 001 - First Governed Slice',
    '',
    'Build the first slice.',
    '',
    'Acceptance criteria:',
    '',
    '- first slice is governed',
  ].join('\n'));

  const result = run(process.execPath, [
    askBinPath,
    'implementation',
    'begin',
    '--title',
    'Runtime Begin Plan',
    '--plan',
    'raw-plan.md',
    '--prefix',
    'rbp',
    '--date',
    '2026-05-09',
    '--task',
    'runtime-begin-plan',
    '--run-id',
    'runtime-begin-run',
  ], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.prepare.markdownPath, 'docs/plans/2026-05-09-runtime-begin-plan.md');
  assert.equal(payload.prepare.planJsonPath, 'docs/plans/2026-05-09-runtime-begin-plan.plan.json');
  assert.equal(payload.readyPlanCommit.committed, true);
  assert.equal(payload.readyPlanCommit.footer, 'ASK-Plan: runtime-begin-plan');
  assert.deepEqual(payload.createdTaskIds, ['rbp-001']);
  assert.equal(payload.nextTask.taskId, 'rbp-001');
  assert.equal(payload.nextAction, 'ask task start rbp-001');
  assert.equal(payload.handoff.state.status, 'ingested');
  assert.equal(typeof payload.handoff.planBatchId, 'string');
  assert.equal(typeof payload.handoff.artifactHash, 'string');

  assert.equal(fs.existsSync(path.join(repoDir, payload.prepare.markdownPath)), true);
  assert.equal(fs.existsSync(path.join(repoDir, payload.prepare.planJsonPath)), true);

  const registry = readJson(path.join(repoDir, '.ask', 'tasks', 'plan-batches.json'));
  assert.deepEqual(registry.artifactHashes[payload.handoff.artifactHash], [payload.handoff.planBatchId]);
  assert.equal(registry.batches[payload.handoff.planBatchId].status, 'completed');
  assert.deepEqual(registry.batches[payload.handoff.planBatchId].createdTaskIds, ['rbp-001']);

  const preflight = run(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(preflight.status, 1, preflight.stdout + preflight.stderr);
  assert.equal(JSON.parse(preflight.stdout).recovery.command, 'ask task start rbp-001');

  const commitMessage = runOrThrow('git', ['log', '-1', '--pretty=%B'], { cwd: repoDir }).stdout;
  assert.match(commitMessage, /chore\(plan\): ready Runtime Begin Plan/i);
  assert.match(commitMessage, /ASK-Plan:\s*runtime-begin-plan/i);
  assert.match(commitMessage, /ASK-Plan-Markdown:\s*docs\/plans\/2026-05-09-runtime-begin-plan\.md/i);
  assert.match(commitMessage, /ASK-Plan-JSON:\s*docs\/plans\/2026-05-09-runtime-begin-plan\.plan\.json/i);

  const rerun = run(process.execPath, [
    askBinPath,
    'implementation',
    'begin',
    '--title',
    'Runtime Begin Plan',
    '--plan',
    'raw-plan.md',
    '--prefix',
    'rbp',
    '--date',
    '2026-05-09',
    '--task',
    'runtime-begin-plan',
    '--run-id',
    'runtime-begin-run',
  ], { cwd: repoDir });
  assert.equal(rerun.status, 0, rerun.stdout + rerun.stderr);
  const rerunPayload = JSON.parse(rerun.stdout);
  assert.equal(rerunPayload.readyPlanCommit.committed, false);
  assert.equal(runOrThrow('git', ['rev-list', '--count', 'HEAD'], { cwd: repoDir }).stdout.trim(), '1');
});

test('implementation begin stops before ready-plan commit when slice extraction is ambiguous', () => {
  const repoDir = setupRepo();
  writeText(path.join(repoDir, 'ambiguous-plan.md'), [
    '# Ambiguous Runtime Begin Plan',
    '',
    '## Summary',
    '',
    'The plan is intended to be sliced but uses unparseable slice notation.',
    '',
    '## Slices',
    '',
    '- Parser Runtime',
    '- Guard Runtime',
  ].join('\n'));

  const result = run(process.execPath, [
    askBinPath,
    'implementation',
    'begin',
    '--title',
    'Ambiguous Runtime Begin Plan',
    '--plan',
    'ambiguous-plan.md',
    '--prefix',
    'arbp',
    '--date',
    '2026-05-09',
    '--task',
    'ambiguous-runtime-begin-plan',
    '--run-id',
    'ambiguous-runtime-begin-run',
  ], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.phase, 'prepare');
  assert.equal(payload.code, 'plan-slice-extraction-ambiguous');
  assert.notEqual(run('git', ['rev-parse', '--verify', 'HEAD'], { cwd: repoDir }).status, 0);
  assert.equal(fs.existsSync(path.join(repoDir, 'docs', 'plans', '2026-05-09-ambiguous-runtime-begin-plan.md')), false);
});

test('implementation begin creates multiple tasks from conversational Slices sections', () => {
  const repoDir = setupRepo();
  writeText(path.join(repoDir, 'conversation-plan.md'), [
    '# Conversational Runtime Begin Plan',
    '',
    '## Summary',
    '',
    'This is the plan shape produced by a normal planning conversation.',
    '',
    '## Slices',
    '',
    '### Parser Runtime',
    '',
    'Add parser support.',
    '',
    'Acceptance criteria:',
    '',
    '- parser task exists',
    '',
    '### Guard Runtime',
    '',
    'Add guard support.',
    '',
    'Acceptance criteria:',
    '',
    '- guard task depends on parser task',
  ].join('\n'));

  const result = run(process.execPath, [
    askBinPath,
    'implementation',
    'begin',
    '--title',
    'Conversational Runtime Begin Plan',
    '--plan',
    'conversation-plan.md',
    '--prefix',
    'crbp',
    '--date',
    '2026-05-09',
    '--task',
    'conversational-runtime-begin-plan',
    '--run-id',
    'conversational-runtime-begin-run',
  ], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.prepare.sourceFormat, 'slices-section-child-headings');
  assert.deepEqual(payload.prepare.sliceTitles, ['Parser Runtime', 'Guard Runtime']);
  assert.deepEqual(payload.createdTaskIds, ['crbp-001', 'crbp-002']);
  assert.equal(payload.nextTask.taskId, 'crbp-001');
});
