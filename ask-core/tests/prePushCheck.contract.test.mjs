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

function setupRepo(branchName = 'ask-runtime', governanceMode = 'maintainer') {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-pre-push-check-'));
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
    governanceMode,
    strictTasksDoc: false,
  });
  return tempRoot;
}

function makeHealthyPrePushState(repoDir) {
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
      'pre-push-governed-proof',
    ],
    { cwd: repoDir }
  );
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh: true,
    testsPassed: true,
    checks: ['unit-tests', 'docs-freshness', 'release-docs'],
  });
}

test('pre-push-check passes in healthy pre-push state', () => {
  const repoDir = setupRepo('ask-runtime');
  makeHealthyPrePushState(repoDir);

  const result = run(process.execPath, [askBinPath, 'pre-push-check'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, true);
  assert.deepEqual(payload.missing, []);
  assert.deepEqual(payload.checks, [
    'work-context',
    'docs-freshness',
    'codex-governance-parity',
    'slice-commit-governance',
    'release-docs',
    'session-preflight',
    'session-can-commit',
  ]);
});

test('pre-push-check fails with deterministic missing entries', () => {
  const repoDir = setupRepo('ask-runtime');
  makeHealthyPrePushState(repoDir);
  writeJson(path.join(repoDir, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: 'release/mainline',
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    governanceMode: 'maintainer',
    strictTasksDoc: false,
  });

  const result = run(process.execPath, [askBinPath, 'pre-push-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, false);
  assert.match(JSON.stringify(payload.missing), /work context mismatch/i);
  assert.deepEqual(payload.checks, [
    'work-context',
    'docs-freshness',
    'codex-governance-parity',
    'slice-commit-governance',
    'release-docs',
    'session-preflight',
    'session-can-commit',
  ]);
});

test('pre-push-check in project mode skips release-docs check', () => {
  const repoDir = setupRepo('main', 'project');
  makeHealthyPrePushState(repoDir);

  const result = run(process.execPath, [askBinPath, 'pre-push-check'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, true);
  assert.deepEqual(payload.missing, []);
  assert.deepEqual(payload.checks, ['work-context', 'docs-freshness', 'codex-governance-parity', 'slice-commit-governance', 'session-preflight', 'session-can-commit']);
});

test('pre-push-check fails when codex governance parity evidence is missing', () => {
  const repoDir = setupRepo('ask-runtime');
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh: true,
    testsPassed: true,
    checks: ['unit-tests', 'docs-freshness', 'release-docs'],
  });

  const result = run(process.execPath, [askBinPath, 'pre-push-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, false);
  assert.match(JSON.stringify(payload.missing), /governed codex launch evidence required/i);
});

test('pre-push-check fails when outgoing commit is missing ASK-Slice footer', () => {
  const repoDir = setupRepo('ask-runtime');
  makeHealthyPrePushState(repoDir);

  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'feature.js'), 'export const feature = 1;\n', 'utf8');
  runOrThrow('git', ['add', '.'], { cwd: repoDir });
  runOrThrow('git', ['commit', '-m', 'feat: missing slice footer'], { cwd: repoDir });

  const result = run(process.execPath, [askBinPath, 'pre-push-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, false);
  assert.match(JSON.stringify(payload.missing), /missing ASK-Slice footer/i);
});

test('pre-push-check scans all outgoing commits when branch has no upstream', () => {
  const repoDir = setupRepo('ask-runtime');
  makeHealthyPrePushState(repoDir);

  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'first-push-gap.js'), 'export const gap = true;\n', 'utf8');
  runOrThrow('git', ['add', 'src/first-push-gap.js'], { cwd: repoDir });
  runOrThrow('git', ['commit', '-m', 'feat: missing slice footer'], { cwd: repoDir });

  fs.writeFileSync(path.join(repoDir, 'README.md'), '# metadata only\n', 'utf8');
  runOrThrow('git', ['add', 'README.md'], { cwd: repoDir });
  runOrThrow('git', ['commit', '-m', 'docs: metadata update', '-m', 'ASK-Exempt: meta'], { cwd: repoDir });

  const result = run(process.execPath, [askBinPath, 'pre-push-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.passed, false);
  assert.match(JSON.stringify(payload.missing), /missing ASK-Slice footer/i);
  assert.equal(payload.commitGovernance.checkedCommits.length >= 2, true);
});

test('pre-push-check allows ASK-Plan commits only for docs/plans artifacts', () => {
  const repoDir = setupRepo('ask-runtime');
  makeHealthyPrePushState(repoDir);

  fs.mkdirSync(path.join(repoDir, 'docs', 'plans'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'docs', 'plans', 'runtime-plan.md'), '# Runtime Plan\n', 'utf8');
  fs.writeFileSync(path.join(repoDir, 'docs', 'plans', 'runtime-plan.plan.json'), '{"taskId":"runtime-plan"}\n', 'utf8');
  runOrThrow('git', ['add', 'docs/plans/runtime-plan.md', 'docs/plans/runtime-plan.plan.json'], { cwd: repoDir });
  runOrThrow('git', ['commit', '-m', 'chore(plan): ready runtime plan', '-m', 'ASK-Plan: runtime-plan'], { cwd: repoDir });

  const valid = run(process.execPath, [askBinPath, 'pre-push-check'], { cwd: repoDir });
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  const validPayload = JSON.parse(valid.stdout);
  assert.equal(validPayload.passed, true);
  assert.deepEqual(validPayload.commitGovernance.checkedCommits.at(-1).planIds, ['runtime-plan']);

  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'implementation.js'), 'export const implementation = true;\n', 'utf8');
  runOrThrow('git', ['add', 'src/implementation.js'], { cwd: repoDir });
  runOrThrow('git', ['commit', '-m', 'chore(plan): invalid implementation', '-m', 'ASK-Plan: invalid-plan'], { cwd: repoDir });

  const invalid = run(process.execPath, [askBinPath, 'pre-push-check'], { cwd: repoDir });
  assert.equal(invalid.status, 1, invalid.stdout + invalid.stderr);
  const invalidPayload = JSON.parse(invalid.stdout);
  assert.equal(invalidPayload.passed, false);
  assert.match(JSON.stringify(invalidPayload.missing), /ASK-Plan commit .* only change docs\/plans artifacts/i);
});
