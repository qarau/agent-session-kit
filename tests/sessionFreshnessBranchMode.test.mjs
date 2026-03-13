import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testDir, '..');
const askBinPath = path.join(repoRoot, 'ask-core', 'bin', 'ask.js');

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

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function setupRepo(branchName, branchEnforcementMode = null) {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-session-freshness-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', branchName], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  const activeContext = {
    expectedBranch: branchName,
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    bypassEnvVar: 'SESSION_CONTEXT_BYPASS',
    strictTasksDoc: false,
  };
  if (branchEnforcementMode) {
    activeContext.branchEnforcementMode = branchEnforcementMode;
  }
  writeJson(path.join(repoDir, 'docs', 'session', 'active-work-context.json'), activeContext);
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh: true,
    testsPassed: true,
    checks: ['unit-tests', 'docs-freshness'],
  });
  return repoDir;
}

function stageFile(repoDir, relativePath, content) {
  const fullPath = path.join(repoDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  runOrThrow('git', ['add', relativePath], { cwd: repoDir });
}

test('feature branch with meaningful changes stays advisory', () => {
  const repoDir = setupRepo('feature/ask-runtime');
  stageFile(repoDir, 'src/feature.txt', 'hello\n');

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('main branch with missing session docs fails in enforce mode', () => {
  const repoDir = setupRepo('main');
  stageFile(repoDir, 'src/main-change.txt', 'hello\n');

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.match(JSON.stringify(payload.missing), /session docs freshness required/i);
});

test('feature branch with branchEnforcementMode=all fails for missing session docs', () => {
  const repoDir = setupRepo('feature/ask-runtime', 'all');
  stageFile(repoDir, 'src/feature-strict.txt', 'hello\n');

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.match(JSON.stringify(payload.missing), /session docs freshness required/i);
});

test('staged local runtime file is always rejected', () => {
  const repoDir = setupRepo('feature/ask-runtime');
  stageFile(repoDir, 'docs/ASK_Runtime/local-note.md', 'private note\n');

  const result = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.match(JSON.stringify(payload.missing), /session docs freshness required/i);
});
