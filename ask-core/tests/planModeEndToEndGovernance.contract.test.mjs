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

function writeJson(filePath, payload) {
  writeText(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-plan-mode-e2e-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  writeJson(path.join(repoDir, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: 'ask-runtime',
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    governanceMode: 'project',
    strictTasksDoc: false,
  });
  runOrThrow('git', ['add', '.'], { cwd: repoDir });
  runOrThrow('git', ['commit', '-m', 'baseline'], { cwd: repoDir });
  runOrThrow('git', ['branch', 'main'], { cwd: repoDir });
  return repoDir;
}

function prepareGovernedSession(repoDir) {
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  runOrThrow(process.execPath, [
    askBinPath,
    'codex',
    '--command',
    process.execPath,
    '--command-arg',
    '-e',
    '--command-arg',
    'process.exit(0)',
    '--operation',
    'plan-mode-e2e-proof',
  ], { cwd: repoDir });
  runOrThrow(process.execPath, [
    askBinPath,
    'evidence',
    'checks',
    'record',
    '--tests-passed',
    'true',
    '--docs-fresh',
    'true',
    '--checks',
    'unit-tests,docs-freshness',
  ], { cwd: repoDir });
}

function writePlanArtifacts(repoDir) {
  writeText(
    path.join(repoDir, 'docs', 'plans', 'e2e-plan.md'),
    '# Plan Mode E2E Contract\n\n## Slice 001\n\nProve governed implementation handoff.\n'
  );
  writeJson(path.join(repoDir, 'docs', 'plans', 'e2e-plan.json'), {
    schemaVersion: 2,
    planPrefix: 'e2e',
    planTitle: 'Plan Mode E2E Contract',
    slices: [
      {
        sliceId: 'governed-implementation',
        title: 'Governed implementation',
        description: 'Prove plan handoff, preflight, provenance, and slice close.',
        acceptanceCriteria: ['slice closes with ASK provenance'],
        queueClass: 'reviewer',
      },
    ],
  });
}

function writeCommitMessage(repoDir, content) {
  const filePath = path.join(repoDir, 'COMMIT_EDITMSG');
  writeText(filePath, content);
  return filePath;
}

test('plan-mode handoff governs implementation from plan artifact through slice-close provenance', () => {
  const repoDir = setupRepo();
  prepareGovernedSession(repoDir);
  writePlanArtifacts(repoDir);

  const handoffResult = runOrThrow(process.execPath, [
    askBinPath,
    'plan-mode',
    'handoff',
    '--title',
    'Plan Mode E2E Contract',
    '--source',
    'docs/plans/e2e-plan.md',
    '--plan-json',
    'docs/plans/e2e-plan.json',
    '--task',
    'plan-mode-e2e',
    '--run-id',
    'plan-mode-e2e-run',
    '--workflow',
    'superpowers',
    '--skill',
    'writing-plans',
  ], { cwd: repoDir });
  const handoff = JSON.parse(handoffResult.stdout);
  assert.equal(handoff.ok, true);
  assert.deepEqual(handoff.createdTaskIds, ['e2e-001']);

  const nextResult = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const next = JSON.parse(nextResult.stdout);
  assert.equal(next.next.action, 'ask task start e2e-001');
  assert.equal(next.planModeHandoff.nextTaskId, 'e2e-001');

  const beforeStart = run(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(beforeStart.status, 1, beforeStart.stdout + beforeStart.stderr);
  const beforeStartPayload = JSON.parse(beforeStart.stdout);
  assert.equal(beforeStartPayload.passed, false);
  assert.equal(beforeStartPayload.recovery.command, 'ask task start e2e-001');

  writeText(path.join(repoDir, 'src', 'e2e-feature.js'), 'export const e2eFeature = true;\n');
  runOrThrow('git', ['add', 'src/e2e-feature.js'], { cwd: repoDir });
  const bypass = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(bypass.status, 1, bypass.stdout + bypass.stderr);
  const bypassPayload = JSON.parse(bypass.stdout);
  assert.equal(bypassPayload.passed, false);
  assert.ok(bypassPayload.checks.includes('implementation-preflight'));
  assert.match(JSON.stringify(bypassPayload.missing), /active-ask-slice/i);
  runOrThrow('git', ['reset', '--', 'src/e2e-feature.js'], { cwd: repoDir });

  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'e2e-001'], { cwd: repoDir });
  const afterStart = runOrThrow(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(JSON.parse(afterStart.stdout).passed, true);

  const missingMessage = run(process.execPath, [
    askBinPath,
    'commit-msg-check',
    writeCommitMessage(repoDir, 'feat: ungoverned implementation\n'),
  ], { cwd: repoDir });
  assert.equal(missingMessage.status, 1, missingMessage.stdout + missingMessage.stderr);
  assert.match(JSON.stringify(JSON.parse(missingMessage.stdout).missing), /missing ASK-Slice footer/i);

  const validMessage = runOrThrow(process.execPath, [
    askBinPath,
    'commit-msg-check',
    writeCommitMessage(repoDir, 'feat: governed implementation\n\nASK-Slice: e2e-001\n'),
  ], { cwd: repoDir });
  assert.deepEqual(JSON.parse(validMessage.stdout).sliceIds, ['e2e-001']);

  const closeResult = run(process.execPath, [askBinPath, 'slice', 'close', 'e2e-001'], { cwd: repoDir });
  assert.equal(closeResult.status, 0, closeResult.stdout + closeResult.stderr);
  const closePayload = JSON.parse(closeResult.stdout);
  assert.equal(closePayload.ok, true);
  assert.equal(closePayload.prePush.passed, true);
  assert.equal(closePayload.commit.footer, 'ASK-Slice: e2e-001');

  const commitMessage = runOrThrow('git', ['log', '-1', '--pretty=%B'], { cwd: repoDir }).stdout;
  assert.match(commitMessage, /ASK-Slice:\s*e2e-001/i);
});
