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

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-preflight-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  return tempRoot;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function seedContext(repoDir) {
  writeJson(path.join(repoDir, '.ask', 'state', 'work-context.json'), {
    repoRoot: repoDir,
    branch: 'ask-runtime',
    worktree: repoDir,
    verifiedAt: '2026-03-12T00:00:00.000Z',
  });
}

function seedSession(repoDir, status) {
  writeJson(path.join(repoDir, '.ask', 'sessions', 'active-session.json'), {
    sessionId: 'sess_contract',
    status,
    branch: 'ask-runtime',
    worktree: repoDir,
    repoRoot: repoDir,
    taskId: '',
    actorType: 'human',
    actorId: 'local',
    startedAt: '2026-03-12T00:00:00.000Z',
    lastActiveAt: '2026-03-12T00:00:00.000Z',
    closedAt: '',
  });
}

function seedEvidence(repoDir, docsFresh, testsPassed) {
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh,
    testsPassed,
    checks: [],
  });
}

test('preflight accepts active and paused session states when context is verified', () => {
  for (const allowedStatus of ['active', 'paused']) {
    const repoDir = setupRepo();
    seedContext(repoDir);
    seedSession(repoDir, allowedStatus);

    const result = run(process.execPath, [askBinPath, 'preflight'], { cwd: repoDir });
    assert.equal(result.status, 0, `${allowedStatus} should pass preflight: ${result.stdout}${result.stderr}`);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.passed, true);
    assert.deepEqual(payload.missing, []);
  }
});

test('preflight rejects blocked, closed, and created session states', () => {
  for (const disallowedStatus of ['blocked', 'closed', 'created']) {
    const repoDir = setupRepo();
    seedContext(repoDir);
    seedSession(repoDir, disallowedStatus);

    const result = run(process.execPath, [askBinPath, 'preflight'], { cwd: repoDir });
    assert.equal(result.status, 1, `${disallowedStatus} should fail preflight`);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.passed, false);
    assert.match(JSON.stringify(payload.missing), /session state .* not allowed for preflight/i);
  }
});

test('can-commit returns ok=false with docs and tests missing when evidence is false', () => {
  const repoDir = setupRepo();

  const result = run(process.execPath, [askBinPath, 'can-commit'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.match(JSON.stringify(payload.missing), /docs freshness/i);
  assert.match(JSON.stringify(payload.missing), /tests/i);
});

test('can-commit rejects blocked, closed, and created states even with evidence true', () => {
  for (const disallowedStatus of ['blocked', 'closed', 'created']) {
    const repoDir = setupRepo();
    seedSession(repoDir, disallowedStatus);
    seedEvidence(repoDir, true, true);

    const result = run(process.execPath, [askBinPath, 'can-commit'], { cwd: repoDir });
    assert.equal(result.status, 1, `${disallowedStatus} should fail can-commit`);

    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.match(JSON.stringify(payload.missing), /session state .* not allowed for can-commit/i);
  }
});
