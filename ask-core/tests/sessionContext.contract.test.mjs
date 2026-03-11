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

function normalizePath(value) {
  return value.replaceAll('\\', '/');
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-session-context-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  return tempRoot;
}

test('ask session start writes active session bound to current branch/worktree', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const sessionPath = path.join(repoDir, '.ask', 'sessions', 'active-session.json');
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

  assert.equal(session.status, 'active');
  assert.equal(session.branch, 'ask-runtime');
  assert.equal(normalizePath(session.worktree), normalizePath(repoDir));
});

test('ask context verify writes non-empty context metadata', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });

  const contextPath = path.join(repoDir, '.ask', 'state', 'work-context.json');
  const context = JSON.parse(fs.readFileSync(contextPath, 'utf8'));

  assert.equal(context.branch, 'ask-runtime');
  assert.equal(normalizePath(context.worktree), normalizePath(repoDir));
  assert.equal(normalizePath(context.repoRoot), normalizePath(repoDir));
  assert.equal(typeof context.verifiedAt, 'string');
  assert.notEqual(context.verifiedAt.length, 0);
});
