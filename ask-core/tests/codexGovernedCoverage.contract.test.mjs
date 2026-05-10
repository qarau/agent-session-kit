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
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-codex-coverage-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'main'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  writeJson(path.join(repoDir, 'docs', 'session', 'active-work-context.json'), {
    expectedBranch: 'main',
    expectedRepoPathSuffix: '',
    enforceRepoPathSuffix: false,
    governanceMode: 'project',
  });
  runOrThrow('git', ['add', '.'], { cwd: repoDir });
  runOrThrow('git', ['commit', '-m', 'baseline'], { cwd: repoDir });
  return repoDir;
}

test('interactive codex checkpoint satisfies change-gate coverage without governed launch', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], { cwd: repoDir });
  writeJson(path.join(repoDir, '.ask', 'evidence', 'latest-checks.json'), {
    docsFresh: true,
    testsPassed: true,
    checks: ['unit-tests', 'docs-freshness'],
  });
  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'src', 'manual.js'), 'export const manual = true;\n', 'utf8');
  fs.writeFileSync(path.join(repoDir, 'docs', 'session', 'current-status.md'), '# Current Status\n\nManual codex checkpoint coverage.\n', 'utf8');
  fs.writeFileSync(path.join(repoDir, 'docs', 'session', 'change-log.md'), '# Change Log\n\n- Manual codex checkpoint coverage.\n', 'utf8');
  runOrThrow('git', ['add', 'src/manual.js', 'docs/session/current-status.md', 'docs/session/change-log.md'], { cwd: repoDir });

  const missingResult = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(missingResult.status, 1, missingResult.stdout + missingResult.stderr);
  assert.match(JSON.stringify(JSON.parse(missingResult.stdout).missing), /governed codex launch evidence required/i);

  const checkpoint = run(process.execPath, [
    askBinPath,
    'codex',
    'checkpoint',
    '--operation',
    'manual-codex-work',
    '--touched-file',
    'src/manual.js',
  ], { cwd: repoDir });
  assert.equal(checkpoint.status, 0, checkpoint.stdout + checkpoint.stderr);
  assert.equal(JSON.parse(checkpoint.stdout).ok, true);

  const passingResult = run(process.execPath, [askBinPath, 'pre-commit-check'], { cwd: repoDir });
  assert.equal(passingResult.status, 0, passingResult.stdout + passingResult.stderr);
  assert.equal(JSON.parse(passingResult.stdout).passed, true);
});
