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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-design-lifecycle-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  return repoDir;
}

function seedDesignRegion(repoDir) {
  const visualMapPath = path.join(repoDir, '.ask', 'design', 'visual-regression-map.json');
  const patternsPath = path.join(repoDir, '.ask', 'design', 'component-patterns.json');
  fs.writeFileSync(visualMapPath, JSON.stringify({
    'checkout-hero': {
      files: ['src/checkout/**'],
      protectedRules: ['same-shell'],
      status: 'exploratory',
    },
  }, null, 2), 'utf8');
  fs.writeFileSync(patternsPath, JSON.stringify({
    'checkout-hero': {
      status: 'exploratory',
      sourceFile: 'src/checkout/HeroPanel.tsx',
    },
  }, null, 2), 'utf8');
}

test('design lifecycle promotions enforce sequential transitions and approval governance', () => {
  const repoDir = setupRepo();
  seedDesignRegion(repoDir);

  const toEmerging = runOrThrow(process.execPath, [
    askBinPath, 'design', 'promote', 'checkout-hero',
    '--to', 'emerging',
    '--reason', 'Observed repeatedly across multiple feature slices',
  ], { cwd: repoDir });
  const emergingPayload = JSON.parse(toEmerging.stdout);
  assert.equal(emergingPayload.ok, true);
  assert.equal(emergingPayload.summary.to, 'emerging');

  const toGuided = runOrThrow(process.execPath, [
    askBinPath, 'design', 'promote', 'checkout-hero',
    '--to', 'guided',
    '--reason', 'Design tokens and component conventions now defined',
  ], { cwd: repoDir });
  const guidedPayload = JSON.parse(toGuided.stdout);
  assert.equal(guidedPayload.ok, true);
  assert.equal(guidedPayload.summary.to, 'guided');

  const missingStandardizedApproval = run(process.execPath, [
    askBinPath, 'design', 'promote', 'checkout-hero',
    '--to', 'standardized',
    '--reason', 'Visual identity must stay coherent across all checkout surfaces',
  ], { cwd: repoDir });
  assert.equal(missingStandardizedApproval.status, 1);
  const missingStandardizedPayload = JSON.parse(missingStandardizedApproval.stdout);
  assert.equal(missingStandardizedPayload.code, 'missing-promotion-approval');

  const toStandardized = runOrThrow(process.execPath, [
    askBinPath, 'design', 'promote', 'checkout-hero',
    '--to', 'standardized',
    '--reason', 'Visual identity must stay coherent across all checkout surfaces',
    '--approved-by', 'design-owner',
  ], { cwd: repoDir });
  const standardizedPayload = JSON.parse(toStandardized.stdout);
  assert.equal(standardizedPayload.ok, true);
  assert.equal(standardizedPayload.summary.to, 'standardized');

  const missingProtectedTicket = run(process.execPath, [
    askBinPath, 'design', 'promote', 'checkout-hero',
    '--to', 'protected',
    '--reason', 'Brand-critical layout must remain protected for release quality',
    '--approved-by', 'design-council',
  ], { cwd: repoDir });
  assert.equal(missingProtectedTicket.status, 1);
  const missingProtectedPayload = JSON.parse(missingProtectedTicket.stdout);
  assert.equal(missingProtectedPayload.code, 'missing-promotion-approval-ticket');

  const toProtected = runOrThrow(process.execPath, [
    askBinPath, 'design', 'promote', 'checkout-hero',
    '--to', 'protected',
    '--reason', 'Brand-critical layout must remain protected for release quality',
    '--approved-by', 'design-council',
    '--approval-ticket', 'DESIGN-101',
  ], { cwd: repoDir });
  const protectedPayload = JSON.parse(toProtected.stdout);
  assert.equal(protectedPayload.ok, true);
  assert.equal(protectedPayload.summary.to, 'protected');
  assert.equal(protectedPayload.stageCounts.protected, 1);
});

test('design promotion rejects non-sequential lifecycle jumps', () => {
  const repoDir = setupRepo();
  seedDesignRegion(repoDir);

  const invalid = run(process.execPath, [
    askBinPath, 'design', 'promote', 'checkout-hero',
    '--to', 'guided',
    '--reason', 'Attempted jump across lifecycle stages',
  ], { cwd: repoDir });
  assert.equal(invalid.status, 1);
  const payload = JSON.parse(invalid.stdout);
  assert.equal(payload.code, 'invalid-stage-transition');
});

