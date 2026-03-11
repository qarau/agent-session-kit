import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testDir = path.dirname(thisFilePath);
const kitRoot = path.resolve(testDir, '..');
const verifierPath = path.join(kitRoot, 'kit', 'scripts', 'session', 'verifySessionDocsFreshness.mjs');

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

function setupRepo(branchName) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-session-freshness-'));
  const repoDir = path.join(tempRoot, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', branchName], { cwd: repoDir });

  return repoDir;
}

function stageFile(repoDir, relativePath, content) {
  const fullPath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  runOrThrow('git', ['add', relativePath], { cwd: repoDir });
}

test('feature branch with meaningful changes warns in advisory mode', () => {
  const repoDir = setupRepo('feature/ask-runtime');
  stageFile(repoDir, 'src/feature.txt', 'hello\n');

  const result = run(process.execPath, [verifierPath, '--mode', 'pre-commit'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(`${result.stdout}\n${result.stderr}`, /advisory mode/i);
});

test('main branch with missing session docs fails in enforce mode', () => {
  const repoDir = setupRepo('main');
  stageFile(repoDir, 'src/main-change.txt', 'hello\n');

  const result = run(process.execPath, [verifierPath, '--mode', 'pre-commit'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /\[session-freshness:pre-commit\] guard failed/);
});

test('staged local runtime file is always rejected', () => {
  const repoDir = setupRepo('feature/ask-runtime');
  stageFile(repoDir, 'docs/ASK_Runtime/local-note.md', 'private note\n');

  const result = run(process.execPath, [verifierPath, '--mode', 'pre-commit'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(`${result.stdout}\n${result.stderr}`, /docs\/ASK_Runtime/i);
});
