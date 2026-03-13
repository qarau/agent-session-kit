import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { SuperpowersAdapter } from '../src/adapters/SuperpowersAdapter.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

function createTask(status) {
  return {
    id: 'task-1',
    status,
  };
}

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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-superpowers-enterprise-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Enterprise wiring'], { cwd: repoDir });
  return repoDir;
}

function writePolicy(repoDir, content) {
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  fs.mkdirSync(path.dirname(policyPath), { recursive: true });
  fs.writeFileSync(policyPath, content, 'utf8');
}

test('superpowers adapter rejects unpinned provider version', () => {
  const adapter = new SuperpowersAdapter({
    providerVersion: '',
    approvedVersions: ['0.3.0'],
    compatibilityMatrix: { '0.3.0': true },
    allowedSkills: ['writing-plans', 'executing-plans', 'verification-before-completion'],
  });

  assert.throws(
    () => adapter.recommend({ task: createTask('created') }),
    error => error?.code === 'provider-version-required'
  );
});

test('superpowers adapter rejects non-allowlisted recommendation skill', () => {
  const adapter = new SuperpowersAdapter({
    providerVersion: '0.3.0',
    approvedVersions: ['0.3.0'],
    compatibilityMatrix: { '0.3.0': true },
    allowedSkills: ['executing-plans'],
  });

  assert.throws(
    () => adapter.recommend({ task: createTask('created') }),
    error => error?.code === 'skill-not-allowed'
  );
});

test('superpowers adapter provider compatibility status reports pass and fail by version', () => {
  const adapter = new SuperpowersAdapter({
    providerVersion: '0.3.0',
    approvedVersions: ['0.3.0', '0.4.0'],
    compatibilityMatrix: {
      '0.3.0': true,
      '0.4.0': false,
    },
    allowedSkills: ['writing-plans', 'executing-plans', 'verification-before-completion'],
  });

  const pass = adapter.providerStatus('0.3.0');
  assert.equal(pass.ok, true);
  assert.equal(pass.status, 'compatible');
  assert.equal(pass.version, '0.3.0');

  const fail = adapter.providerStatus('0.4.0');
  assert.equal(fail.ok, false);
  assert.equal(fail.code, 'provider-version-incompatible');
  assert.equal(fail.status, 'incompatible');
  assert.equal(fail.version, '0.4.0');
});

test('superpowers adapter kill switch returns deterministic fallback recommendation', () => {
  const adapter = new SuperpowersAdapter({
    enabled: false,
    fallbackSkill: 'executing-plans',
    providerVersion: '0.3.0',
    approvedVersions: ['0.3.0'],
    compatibilityMatrix: { '0.3.0': true },
    allowedSkills: ['writing-plans', 'executing-plans', 'verification-before-completion'],
  });

  const first = adapter.recommend({ task: createTask('created') });
  const second = adapter.recommend({ task: createTask('completed'), verification: { status: 'failed' } });

  assert.equal(first.workflow, 'superpowers');
  assert.equal(first.skill, 'executing-plans');
  assert.equal(first.fallback, true);
  assert.equal(first.code, 'provider-disabled');

  assert.equal(second.workflow, 'superpowers');
  assert.equal(second.skill, 'executing-plans');
  assert.equal(second.fallback, true);
  assert.equal(second.code, 'provider-disabled');
});

test('workflow recommend honors provider kill switch policy fallback', () => {
  const repoDir = setupRepo();
  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: true
  require_tests_before_commit: true

workflow_provider:
  superpowers_enabled: false
  superpowers_version: 0.3.0
  superpowers_approved_versions: 0.3.0
  superpowers_allowed_skills: writing-plans,executing-plans,verification-before-completion
  superpowers_fallback_skill: executing-plans
  superpowers_incompatible_versions:
`
  );

  const result = runOrThrow(process.execPath, [askBinPath, 'workflow', 'recommend', 'task-1'], {
    cwd: repoDir,
  });
  const payload = JSON.parse(result.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.recommendation.workflow, 'superpowers');
  assert.equal(payload.recommendation.skill, 'executing-plans');
  assert.equal(payload.recommendation.fallback, true);
  assert.equal(payload.recommendation.code, 'provider-disabled');
});

test('workflow-provider status reports compatibility and fails on incompatible version', () => {
  const repoDir = setupRepo();
  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: true
  require_tests_before_commit: true

workflow_provider:
  superpowers_enabled: true
  superpowers_version: 0.3.0
  superpowers_approved_versions: 0.3.0,0.4.0
  superpowers_allowed_skills: writing-plans,executing-plans,verification-before-completion
  superpowers_fallback_skill: executing-plans
  superpowers_incompatible_versions: 0.4.0
`
  );

  const pass = runOrThrow(process.execPath, [askBinPath, 'workflow-provider', 'status'], {
    cwd: repoDir,
  });
  const passPayload = JSON.parse(pass.stdout);
  assert.equal(passPayload.ok, true);
  assert.equal(passPayload.status, 'compatible');
  assert.equal(passPayload.version, '0.3.0');

  const fail = run(process.execPath, [askBinPath, 'workflow-provider', 'status', '--version', '0.4.0'], {
    cwd: repoDir,
  });
  assert.equal(fail.status, 1, fail.stdout + fail.stderr);
  const failPayload = JSON.parse(fail.stdout);
  assert.equal(failPayload.ok, false);
  assert.equal(failPayload.status, 'incompatible');
  assert.equal(failPayload.code, 'provider-version-incompatible');
  assert.equal(failPayload.version, '0.4.0');
});
