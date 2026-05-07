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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-governance-surface-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  return tempRoot;
}

test('governance status and explain commands return structured payloads', () => {
  const repoDir = setupRepo();
  const status = runOrThrow(process.execPath, [askBinPath, 'governance', 'status'], { cwd: repoDir });
  const statusPayload = JSON.parse(status.stdout);
  assert.equal(statusPayload.ok, true);
  assert.equal(typeof statusPayload.runtimeStatus, 'string');
  assert.equal(typeof statusPayload.continuityValid, 'boolean');

  const explain = runOrThrow(process.execPath, [askBinPath, 'governance', 'explain'], { cwd: repoDir });
  const explainPayload = JSON.parse(explain.stdout);
  assert.equal(explainPayload.ok, true);
  assert.equal(typeof explainPayload.explanation.decision, 'string');
  assert.equal(Array.isArray(explainPayload.explanation.steps), true);
});

test('architect exemption commands add and list OHDER exemptions', () => {
  const repoDir = setupRepo();
  const add = runOrThrow(process.execPath, [
    askBinPath,
    'architect',
    'exempt',
    'add',
    '--law-id',
    'ohder-entropy-budget',
    '--reason',
    'Temporary mitigation while refactor is in progress',
    '--approved-by',
    'arch-lead',
    '--operation',
    'deep-refactor',
  ], { cwd: repoDir });
  const addPayload = JSON.parse(add.stdout);
  assert.equal(addPayload.ok, true);
  assert.equal(addPayload.exemption.lawId, 'ohder-entropy-budget');

  const list = runOrThrow(process.execPath, [askBinPath, 'architect', 'exempt', 'list'], { cwd: repoDir });
  const listPayload = JSON.parse(list.stdout);
  assert.equal(listPayload.ok, true);
  assert.equal(Array.isArray(listPayload.exemptions), true);
  assert.equal(listPayload.exemptions.length >= 1, true);
  assert.equal(listPayload.exemptions[0].lawId, 'ohder-entropy-budget');
});
