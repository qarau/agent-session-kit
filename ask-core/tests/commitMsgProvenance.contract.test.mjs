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
const repoRoot = path.resolve(askCoreRoot, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');
const commitMsgAdapterPath = path.join(repoRoot, 'scripts', 'session', 'runAskCoreCommitMsgAdapter.mjs');

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

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-commit-msg-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'main'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  return tempRoot;
}

function writeMessage(repoDir, content) {
  const filePath = path.join(repoDir, 'COMMIT_EDITMSG');
  writeText(filePath, content);
  return filePath;
}

test('commit-msg-check accepts ASK-Slice footer and rejects missing provenance', () => {
  const repoDir = setupRepo();
  const valid = runOrThrow(process.execPath, [
    askBinPath,
    'commit-msg-check',
    writeMessage(repoDir, 'feat: governed change\n\nASK-Slice: pmh-004\n'),
  ], { cwd: repoDir });
  const validPayload = JSON.parse(valid.stdout);
  assert.equal(validPayload.passed, true);
  assert.deepEqual(validPayload.sliceIds, ['pmh-004']);

  const missing = run(process.execPath, [
    askBinPath,
    'commit-msg-check',
    writeMessage(repoDir, 'feat: manual implementation\n'),
  ], { cwd: repoDir });
  assert.equal(missing.status, 1, missing.stdout + missing.stderr);
  const missingPayload = JSON.parse(missing.stdout);
  assert.equal(missingPayload.passed, false);
  assert.match(JSON.stringify(missingPayload.missing), /missing ASK-Slice footer/i);
});

test('commit-msg-check accepts scoped maintenance exemption and rejects mixed provenance', () => {
  const repoDir = setupRepo();
  const exempt = runOrThrow(process.execPath, [
    askBinPath,
    'commit-msg-check',
    writeMessage(repoDir, 'docs: release note\n\nASK-Exempt: meta\n'),
  ], { cwd: repoDir });
  assert.equal(JSON.parse(exempt.stdout).exemptKinds[0], 'meta');

  const mixed = run(process.execPath, [
    askBinPath,
    'commit-msg-check',
    writeMessage(repoDir, 'bad: mixed provenance\n\nASK-Slice: pmh-004\nASK-Exempt: meta\n'),
  ], { cwd: repoDir });
  assert.equal(mixed.status, 1, mixed.stdout + mixed.stderr);
  assert.match(JSON.stringify(JSON.parse(mixed.stdout).missing), /cannot include both/i);
});

test('commit-msg hook adapter and installHooks wire commit-msg enforcement', () => {
  const repoDir = setupRepo();
  const validPath = writeMessage(repoDir, 'chore: governed\n\nASK-Slice: pmh-004\n');
  const adapter = runOrThrow(process.execPath, [commitMsgAdapterPath, validPath], { cwd: repoDir });
  assert.equal(JSON.parse(adapter.stdout).passed, true);

  const hook = fs.readFileSync(path.join(repoRoot, '.githooks', 'commit-msg'), 'utf8');
  assert.match(hook, /runAskCoreCommitMsgAdapter\.mjs/);

  const installHooks = fs.readFileSync(path.join(repoRoot, 'scripts', 'session', 'installHooks.mjs'), 'utf8');
  assert.match(installHooks, /commit-msg/);
});
