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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-flow-lifecycle-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  return tempRoot;
}

test('flow lifecycle promotions enforce sequential transitions and approval governance', () => {
  const repoDir = setupRepo();
  const contractPath = path.join(repoDir, '.ask', 'flows', 'product-flow.json');
  fs.writeFileSync(contractPath, JSON.stringify({
    version: 1,
    flows: [
      {
        id: 'checkout-flow',
        name: 'Checkout flow',
        stage: 'experimental',
        given: 'Cart has items',
        when: 'User checks out',
        then: ['Order is created'],
      },
    ],
  }, null, 2), 'utf8');

  const toObserved = runOrThrow(process.execPath, [
    askBinPath,
    'flow',
    'promote',
    'checkout-flow',
    '--to',
    'observed',
    '--reason',
    'Observed repeatedly in manual sessions',
  ], { cwd: repoDir });
  const observedPayload = JSON.parse(toObserved.stdout);
  assert.equal(observedPayload.ok, true);
  assert.equal(observedPayload.summary.to, 'observed');

  const toAccepted = runOrThrow(process.execPath, [
    askBinPath,
    'flow',
    'promote',
    'checkout-flow',
    '--to',
    'accepted',
    '--reason',
    'Confirmed with product intent review',
  ], { cwd: repoDir });
  const acceptedPayload = JSON.parse(toAccepted.stdout);
  assert.equal(acceptedPayload.ok, true);
  assert.equal(acceptedPayload.summary.to, 'accepted');

  const missingProtectedApproval = run(process.execPath, [
    askBinPath,
    'flow',
    'promote',
    'checkout-flow',
    '--to',
    'protected',
    '--reason',
    'Must be preserved for release consistency',
  ], { cwd: repoDir });
  assert.equal(missingProtectedApproval.status, 1);
  const missingProtectedPayload = JSON.parse(missingProtectedApproval.stdout);
  assert.equal(missingProtectedPayload.code, 'missing-promotion-approval');

  const toProtected = runOrThrow(process.execPath, [
    askBinPath,
    'flow',
    'promote',
    'checkout-flow',
    '--to',
    'protected',
    '--reason',
    'Must be preserved for release consistency',
    '--approved-by',
    'flow-owner',
  ], { cwd: repoDir });
  const protectedPayload = JSON.parse(toProtected.stdout);
  assert.equal(protectedPayload.ok, true);
  assert.equal(protectedPayload.summary.to, 'protected');

  const missingHardTicket = run(process.execPath, [
    askBinPath,
    'flow',
    'promote',
    'checkout-flow',
    '--to',
    'hard-flow',
    '--reason',
    'Critical regulated checkout behavior',
    '--approved-by',
    'architecture-council',
  ], { cwd: repoDir });
  assert.equal(missingHardTicket.status, 1);
  const missingHardTicketPayload = JSON.parse(missingHardTicket.stdout);
  assert.equal(missingHardTicketPayload.code, 'missing-promotion-approval-ticket');

  const toHard = runOrThrow(process.execPath, [
    askBinPath,
    'flow',
    'promote',
    'checkout-flow',
    '--to',
    'hard-flow',
    '--reason',
    'Critical regulated checkout behavior',
    '--approved-by',
    'architecture-council',
    '--approval-ticket',
    'ARCH-444',
  ], { cwd: repoDir });
  const hardPayload = JSON.parse(toHard.stdout);
  assert.equal(hardPayload.ok, true);
  assert.equal(hardPayload.summary.to, 'hard-flow');

  const listed = runOrThrow(process.execPath, [askBinPath, 'flow', 'list'], { cwd: repoDir });
  const listPayload = JSON.parse(listed.stdout);
  assert.equal(listPayload.stageCounts['hard-flow'], 1);
});

test('flow promotion rejects non-sequential lifecycle jumps', () => {
  const repoDir = setupRepo();
  const contractPath = path.join(repoDir, '.ask', 'flows', 'product-flow.json');
  fs.writeFileSync(contractPath, JSON.stringify({
    version: 1,
    flows: [
      {
        id: 'profile-flow',
        name: 'Profile update flow',
        stage: 'experimental',
        given: 'User opens profile',
        when: 'User edits details',
        then: ['Profile persists'],
      },
    ],
  }, null, 2), 'utf8');

  const invalidJump = run(process.execPath, [
    askBinPath,
    'flow',
    'promote',
    'profile-flow',
    '--to',
    'accepted',
    '--reason',
    'Attempted jump across lifecycle stages',
  ], { cwd: repoDir });
  assert.equal(invalidJump.status, 1);
  const payload = JSON.parse(invalidJump.stdout);
  assert.equal(payload.code, 'invalid-stage-transition');
});
