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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-implementation-begin-e2e-'));
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
    'implementation-begin-e2e-proof',
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

function setFastFullSuiteCommand(repoDir) {
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  const raw = fs.readFileSync(policyPath, 'utf8');
  const updated = raw
    .replace('full_suite_command: npm', 'full_suite_command: node')
    .replace('full_suite_args: test', 'full_suite_args: -e,process.exit(0)');
  fs.writeFileSync(policyPath, updated, 'utf8');
}

test('implementation begin governs raw plan through active slice and slice-close provenance', () => {
  const repoDir = setupRepo();
  prepareGovernedSession(repoDir);
  setFastFullSuiteCommand(repoDir);
  writeText(path.join(repoDir, 'raw-plan.md'), [
    '# Raw Governed Plan',
    '',
    '## Slice 001 - Governed Runtime Change',
    '',
    'Implement the runtime change only after ASK creates a slice.',
    '',
    'Acceptance criteria:',
    '',
    '- preflight passes after task start',
    '- slice close commits with provenance',
  ].join('\n'));

  const missingHandoff = run(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(missingHandoff.status, 1, missingHandoff.stdout + missingHandoff.stderr);
  assert.equal(JSON.parse(missingHandoff.stdout).recovery.command, 'ask implementation begin --plan <md> --title <title>');

  const begin = runOrThrow(process.execPath, [
    askBinPath,
    'implementation',
    'begin',
    '--title',
    'Raw Governed Plan',
    '--plan',
    'raw-plan.md',
    '--prefix',
    'rgp',
    '--date',
    '2026-05-09',
    '--task',
    'raw-governed-plan',
    '--run-id',
    'raw-governed-plan-run',
  ], { cwd: repoDir });
  const beginPayload = JSON.parse(begin.stdout);
  assert.equal(beginPayload.prepare.markdownPath, 'docs/plans/2026-05-09-raw-governed-plan.md');
  assert.equal(beginPayload.prepare.planJsonPath, 'docs/plans/2026-05-09-raw-governed-plan.plan.json');
  assert.deepEqual(beginPayload.createdTaskIds, ['rgp-001']);
  assert.equal(beginPayload.nextAction, 'ask task start rgp-001');

  const beforeStart = run(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(beforeStart.status, 1, beforeStart.stdout + beforeStart.stderr);
  assert.equal(JSON.parse(beforeStart.stdout).recovery.command, 'ask task start rgp-001');

  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'rgp-001'], { cwd: repoDir });
  const afterStart = runOrThrow(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(JSON.parse(afterStart.stdout).passed, true);

  writeText(path.join(repoDir, 'src', 'runtime-change.js'), 'export const governedRuntimeChange = true;\n');
  const close = run(process.execPath, [askBinPath, 'slice', 'close', 'rgp-001'], { cwd: repoDir });
  assert.equal(close.status, 0, close.stdout + close.stderr);
  const closePayload = JSON.parse(close.stdout);
  assert.equal(closePayload.ok, true);
  assert.equal(closePayload.commit.footer, 'ASK-Slice: rgp-001');
  assert.equal(closePayload.prePush.passed, true);

  const commitMessage = runOrThrow('git', ['log', '-1', '--pretty=%B'], { cwd: repoDir }).stdout;
  assert.match(commitMessage, /ASK-Slice:\s*rgp-001/i);
});
