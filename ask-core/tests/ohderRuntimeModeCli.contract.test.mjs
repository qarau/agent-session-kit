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

function runOrThrow(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
  });
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

function writePolicy(repoDir, mode) {
  fs.writeFileSync(
    path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml'),
    `ohder:\n  mode: ${mode}\n`,
    'utf8'
  );
}

function setupRepo(mode = 'strict') {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-cli-mode-'));
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  writePolicy(repoDir, mode);
  return repoDir;
}

function askJson(repoDir, ...args) {
  const result = runOrThrow(process.execPath, [askBinPath, ...args], { cwd: repoDir });
  return JSON.parse(result.stdout);
}

test('operator CLI output exposes current OHDER mode before architect reassessment', () => {
  const repoDir = setupRepo('strict');

  const architect = askJson(repoDir, 'architect', 'status');
  const projectState = askJson(repoDir, 'project-state');
  const governanceStatus = askJson(repoDir, 'governance', 'status');
  const governanceExplain = askJson(repoDir, 'governance', 'explain');

  assert.equal(architect.ohderMode, 'strict');
  assert.equal(projectState.ohderMode, 'strict');
  assert.equal(governanceStatus.ohderMode, 'strict');
  assert.equal(governanceExplain.ohderMode, 'strict');
  assert.equal(governanceExplain.explanation.ohderMode, 'strict');
  assert.match(governanceExplain.explanation.modeBehavior, /hard-law/i);
});
