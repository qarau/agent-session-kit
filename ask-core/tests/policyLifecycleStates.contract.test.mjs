import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { PolicyEngine } from '../src/core/PolicyEngine.js';

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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-policy-states-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  return tempRoot;
}

test('default policy exposes allowed preflight and can-commit lifecycle states', async () => {
  const repoDir = setupRepo();
  const engine = new PolicyEngine(repoDir);

  const policy = await engine.load();
  assert.deepEqual(policy.session.allowed_preflight_states, ['active', 'paused']);
  assert.deepEqual(policy.session.allowed_can_commit_states, ['active', 'paused']);
});

test('policy parser normalizes comma-delimited lifecycle states', async () => {
  const repoDir = setupRepo();
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  fs.mkdirSync(path.dirname(policyPath), { recursive: true });
  fs.writeFileSync(
    policyPath,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: ACTIVE, paused
  allowed_can_commit_states:  Active, PAUSED

checks:
  require_docs_freshness: true
  require_tests_before_commit: true
`,
    'utf8'
  );

  const engine = new PolicyEngine(repoDir);
  const policy = await engine.load();
  assert.deepEqual(policy.session.allowed_preflight_states, ['active', 'paused']);
  assert.deepEqual(policy.session.allowed_can_commit_states, ['active', 'paused']);
});
