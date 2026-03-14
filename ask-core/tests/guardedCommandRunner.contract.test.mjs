import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { GuardedCommandRunner } from '../src/core/GuardedCommandRunner.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const TEST_TIMEOUT_MS = 600;

function fixturePath(name) {
  return path.join(testsDir, 'fixtures', 'guarded-command', name);
}

function setupTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ask-guarded-command-runner-'));
}

function readLastOperation(repoDir) {
  const filePath = path.join(repoDir, '.ask', 'runtime', 'last-operation.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('runner retries once on stall then succeeds', async () => {
  const repoDir = setupTempRepo();
  const counterPath = path.join(repoDir, '.tmp', 'attempts.txt');
  const runner = new GuardedCommandRunner(repoDir, {
    wallTimeoutMs: TEST_TIMEOUT_MS,
    noOutputTimeoutMs: TEST_TIMEOUT_MS,
    maxRetriesOnStall: 1,
  });

  const result = await runner.run({
    operation: 'contract:retry-once-success',
    command: process.execPath,
    args: [fixturePath('emitThenHang.mjs'), counterPath],
  });

  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
  const state = readLastOperation(repoDir);
  assert.equal(state.status, 'succeeded');
  assert.equal(state.attempt, 2);
  assert.equal(state.maxAttempts, 2);
});

test('runner fails after second stall with deterministic reason', async () => {
  const repoDir = setupTempRepo();
  const runner = new GuardedCommandRunner(repoDir, {
    wallTimeoutMs: TEST_TIMEOUT_MS,
    noOutputTimeoutMs: TEST_TIMEOUT_MS,
    maxRetriesOnStall: 1,
  });

  await assert.rejects(
    runner.run({
      operation: 'contract:stall-fails-after-retry',
      command: process.execPath,
      args: [fixturePath('hangNoOutput.mjs')],
    }),
    /no-output-timeout/i
  );

  const state = readLastOperation(repoDir);
  assert.equal(state.status, 'failed');
  assert.equal(state.attempt, 2);
  assert.equal(state.failureReason, 'no-output-timeout');
});

test('runner does not retry non-zero exits', async () => {
  const repoDir = setupTempRepo();
  const runner = new GuardedCommandRunner(repoDir, {
    wallTimeoutMs: TEST_TIMEOUT_MS,
    noOutputTimeoutMs: TEST_TIMEOUT_MS,
    maxRetriesOnStall: 1,
  });

  await assert.rejects(
    runner.run({
      operation: 'contract:non-zero-no-retry',
      command: process.execPath,
      args: [fixturePath('exitCode.mjs'), '23'],
    }),
    /exit-nonzero/i
  );

  const state = readLastOperation(repoDir);
  assert.equal(state.status, 'failed');
  assert.equal(state.attempt, 1);
  assert.equal(state.failureReason, 'exit-nonzero');
});

test('runner writes deterministic last-operation fields', async () => {
  const repoDir = setupTempRepo();
  const counterPath = path.join(repoDir, '.tmp', 'attempts.txt');
  const runner = new GuardedCommandRunner(repoDir, {
    wallTimeoutMs: TEST_TIMEOUT_MS,
    noOutputTimeoutMs: TEST_TIMEOUT_MS,
    maxRetriesOnStall: 1,
  });

  await runner.run({
    operation: 'contract:last-operation-fields',
    command: process.execPath,
    args: [fixturePath('emitThenHang.mjs'), counterPath],
  });

  const state = readLastOperation(repoDir);
  assert.equal(state.operation, 'contract:last-operation-fields');
  assert.equal(state.status, 'succeeded');
  assert.equal(typeof state.startedAt, 'string');
  assert.equal(typeof state.updatedAt, 'string');
  assert.equal(typeof state.lastOutputAt, 'string');
  assert.equal(state.command.bin, process.execPath);
  assert.equal(Array.isArray(state.command.args), true);
});
