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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-implementation-preflight-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  return tempRoot;
}

function createHandoff(repoDir) {
  writeText(path.join(repoDir, 'docs', 'plans', 'implementation-plan.md'), '# Implementation Plan\n');
  writeJson(path.join(repoDir, 'docs', 'plans', 'implementation-plan.json'), {
    schemaVersion: 2,
    planPrefix: 'ipf',
    planTitle: 'Implementation Preflight Plan',
    slices: [
      {
        sliceId: 'guard',
        title: 'Guard implementation',
        description: 'Require active governed slice.',
        queueClass: 'integrator',
      },
    ],
  });
  runOrThrow(process.execPath, [
    askBinPath,
    'plan-mode',
    'handoff',
    '--title',
    'Implementation Preflight Plan',
    '--source',
    'docs/plans/implementation-plan.md',
    '--plan-json',
    'docs/plans/implementation-plan.json',
    '--task',
    'implementation-plan-source',
    '--run-id',
    'implementation-plan-run',
  ], { cwd: repoDir });
}

test('implementation preflight blocks missing handoff but advisory mode is non-blocking', () => {
  const repoDir = setupRepo();

  const blocked = run(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  const blockedPayload = JSON.parse(blocked.stdout);
  assert.equal(blockedPayload.ok, false);
  assert.equal(blockedPayload.code, 'implementation-preflight-blocked');
  assert.ok(blockedPayload.missing.includes('plan-mode-handoff'));
  assert.equal(blockedPayload.recovery.command, 'ask plan-mode handoff --title <title> --source <md> --plan-json <json>');

  const advisory = runOrThrow(process.execPath, [askBinPath, 'implementation', 'preflight', '--advisory'], { cwd: repoDir });
  const advisoryPayload = JSON.parse(advisory.stdout);
  assert.equal(advisoryPayload.ok, true);
  assert.equal(advisoryPayload.passed, false);
  assert.equal(advisoryPayload.blocking, false);
  assert.equal(advisoryPayload.advisory, true);
});

test('implementation preflight requires active ASK slice after handoff', () => {
  const repoDir = setupRepo();
  createHandoff(repoDir);

  const blocked = run(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  const blockedPayload = JSON.parse(blocked.stdout);
  assert.equal(blockedPayload.ok, false);
  assert.ok(blockedPayload.missing.includes('active-ask-slice'));
  assert.equal(blockedPayload.recovery.command, 'ask task start ipf-001');

  runOrThrow(process.execPath, [askBinPath, 'task', 'start', 'ipf-001'], { cwd: repoDir });
  const passed = runOrThrow(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  const passedPayload = JSON.parse(passed.stdout);
  assert.equal(passedPayload.ok, true);
  assert.equal(passedPayload.passed, true);
  assert.equal(passedPayload.activeTask.taskId, 'ipf-001');
});
