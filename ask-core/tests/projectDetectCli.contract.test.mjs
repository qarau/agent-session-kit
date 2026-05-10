import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const askBinPath = path.join(repoRoot, 'ask-core/bin/ask.js');

function setupProject(files = {}) {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-project-detect-'));
  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(repoDir, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents, 'utf8');
  }
  return repoDir;
}

function runProjectDetect(cwd) {
  const result = spawnSync(process.execPath, [askBinPath, 'project', 'detect'], {
    cwd,
    encoding: 'utf8',
  });
  const stdout = result.stdout.trim();
  return {
    status: result.status,
    stderr: result.stderr.trim(),
    stdout,
    json: stdout ? JSON.parse(stdout) : null,
  };
}

function listRelativeFiles(cwd) {
  return fs.readdirSync(cwd, { recursive: true }).map(String).sort();
}

test('ask project detect identifies the current ASK Forge repo as Node TypeScript', () => {
  const result = runProjectDetect(repoRoot);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.projectType, 'node-typescript');
  assert.equal(result.json.languageId, 'node');
  assert.equal(result.json.adapterId, 'node');
  assert.equal(result.json.profileId, 'node-typescript');
  assert.ok(['pnpm', 'npm', 'yarn', 'bun', 'unknown'].includes(result.json.packageManager));
  assert.ok(['high', 'medium', 'low'].includes(result.json.confidence));
  assert.ok(Array.isArray(result.json.evidence));
  assert.ok(Array.isArray(result.json.warnings));
});

test('ask project detect reports package manager precedence and multiple lockfile warnings', () => {
  const repoDir = setupProject({
    'package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
    'tsconfig.json': '{}',
    'package-lock.json': '{}',
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'yarn.lock': '',
    'bun.lockb': '',
  });
  const result = runProjectDetect(repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.packageManager, 'pnpm');
  assert.match(result.json.warnings.join('\n'), /multiple package manager lockfiles/i);
});

test('ask project detect returns unknown for non-node directories without mutating files', () => {
  const repoDir = setupProject({ 'README.md': '# not node\n' });
  const before = listRelativeFiles(repoDir);
  const result = runProjectDetect(repoDir);
  const after = listRelativeFiles(repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.projectType, 'unknown');
  assert.equal(result.json.packageManager, 'unknown');
  assert.deepEqual(after, before);
});

test('ask project detect fails deterministically for malformed package json', () => {
  const repoDir = setupProject({ 'package.json': '{bad json' });
  const result = runProjectDetect(repoDir);
  assert.equal(result.status, 1);
  assert.equal(result.json.ok, false);
  assert.equal(result.json.code, 'project-detect-invalid-package-json');
});
