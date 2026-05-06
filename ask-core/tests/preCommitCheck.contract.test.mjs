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

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function setupRepo(branchName = 'main') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-pre-commit-check-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', branchName], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  writeJson(path.join(tempRoot, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: branchName,
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    strictTasksDoc: false,
  });
  return tempRoot;
}

function makeHealthyPreCommitState(repoDir) {
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'pre-commit-governed-proof',
    ],
    { cwd: repoDir }
  );
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh: true,
    testsPassed: true,
    checks: ['unit-tests', 'docs-freshness'],
  });
}

test('pre-commit-check passes in healthy pre-commit state', () => {
  const repoDir = setupRepo('main');
  makeHealthyPreCommitState(repoDir);

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, true);
  assert.deepEqual(payload.missing, []);
  assert.deepEqual(payload.checks, ['work-context', 'docs-freshness', 'codex-governance-parity', 'session-preflight', 'session-can-commit']);
});

test('pre-commit-check fails with deterministic missing entries', () => {
  const repoDir = setupRepo('main');
  makeHealthyPreCommitState(repoDir);
  writeJson(path.join(repoDir, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: 'release/mainline',
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    strictTasksDoc: false,
  });

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, false);
  assert.match(JSON.stringify(payload.missing), /work context mismatch for pre-commit/i);
  assert.deepEqual(payload.checks, ['work-context', 'docs-freshness', 'codex-governance-parity', 'session-preflight', 'session-can-commit']);
});

test('pre-commit-check fails when codex governance parity evidence is missing', () => {
  const repoDir = setupRepo('main');
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh: true,
    testsPassed: true,
    checks: ['unit-tests', 'docs-freshness'],
  });

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, false);
  assert.match(JSON.stringify(payload.missing), /governed codex launch evidence required/i);
});

test('pre-commit-check fails when direct launch exception appears in current session', () => {
  const repoDir = setupRepo('main');
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  writeText(path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml'), `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: true
  require_tests_before_commit: true

codex_runtime:
  allow_direct_launch_exception: true
  require_direct_launch_reason: true
  require_direct_launch_approval: true
  require_direct_launch_approval_ticket: true
  require_governed_launch_evidence_for_change_gates: true
  require_governed_checkpoint_for_change_gates: true
  forbid_direct_launch_exception_for_change_gates: true
`);
  runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      'direct',
      '--reason',
      'incident recovery procedure',
      '--approved-by',
      'maintainer-oncall',
      '--approval-ticket',
      'INC-9001',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
    ],
    { cwd: repoDir }
  );
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh: true,
    testsPassed: true,
    checks: ['unit-tests', 'docs-freshness'],
  });

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, false);
  assert.match(JSON.stringify(payload.missing), /direct codex launch exceptions are not allowed/i);
});
