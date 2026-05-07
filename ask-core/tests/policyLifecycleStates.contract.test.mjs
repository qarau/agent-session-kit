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

test('policy engine migrates schema v1 aliases to v2 contract keys', async () => {
  const repoDir = setupRepo();
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  fs.mkdirSync(path.dirname(policyPath), { recursive: true });
  fs.writeFileSync(
    policyPath,
    `version: 1

architect:
  max_entropy: 5
  max_coupling: 4

flow:
  min_replay_confidence: 0.7
  min_protected_confidence: 0.8
  min_hard_confidence: 0.9

autonomy:
  max_slices: 3

retry:
  max_attempts: 4
  max_same_failure: 5
  max_total_failures: 9
`,
    'utf8'
  );

  const engine = new PolicyEngine(repoDir);
  const policy = await engine.load();

  assert.equal(policy.schema_version, 2);
  assert.equal(policy.version, 2);
  assert.equal(policy.architect.max_entropy_delta, 5);
  assert.equal(policy.architect.max_coupling_delta, 4);
  assert.equal(policy.flow.min_behavior_replay_confidence, 0.7);
  assert.equal(policy.flow.min_protected_replay_confidence, 0.8);
  assert.equal(policy.flow.min_hard_flow_replay_confidence, 0.9);
  assert.equal(policy.autonomy.max_slices_per_run, 3);
  assert.equal(policy.retry.max_attempts_per_slice, 4);
  assert.equal(policy.retry.max_same_failure_repeats, 5);
  assert.equal(policy.retry.max_total_failures_per_session, 9);
  assert.equal(policy.governance_contract.policy_schema_version, 2);
  assert.equal(policy.__schema.migrated, true);
});
