import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const askBinPath = path.join(repoRoot, 'ask-core/bin/ask.js');

function setupProject(files = {}) {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-adapter-resolve-'));
  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(repoDir, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents, 'utf8');
  }
  return repoDir;
}

function runAdapterResolve(cwd, args = []) {
  const result = spawnSync(process.execPath, [askBinPath, 'adapter', 'resolve', ...args], {
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

test('ask adapter resolve uses explicit node adapter without project detection', () => {
  const repoDir = setupProject({ 'README.md': '# unknown\n' });
  const result = runAdapterResolve(repoDir, ['--adapter', 'node']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.adapterId, 'node');
  assert.equal(result.json.languageId, 'node');
  assert.equal(result.json.source, 'explicit');
  assert.equal(result.json.detection, null);
  assert.ok(result.json.capabilities.includes('detect'));
  assert.ok(Array.isArray(result.json.evidence));
});

test('ask adapter resolve reads .ask project profile when explicit adapter is absent', () => {
  const repoDir = setupProject({
    '.ask/project-profile.json': JSON.stringify({
      adapterId: 'node',
      languageId: 'node',
      profileId: 'node-typescript',
    }),
  });
  const result = runAdapterResolve(repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.adapterId, 'node');
  assert.equal(result.json.profileId, 'node-typescript');
  assert.equal(result.json.source, 'profile');
  assert.ok(result.json.evidence.includes('.ask/project-profile.json'));
});

test('ask adapter resolve falls back to Node project detection', () => {
  const repoDir = setupProject({
    'package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
    'tsconfig.json': '{}',
  });
  const result = runAdapterResolve(repoDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.adapterId, 'node');
  assert.equal(result.json.languageId, 'node');
  assert.equal(result.json.profileId, 'node-typescript');
  assert.equal(result.json.source, 'detection');
  assert.equal(result.json.detection.projectType, 'node-typescript');
});

test('ask adapter resolve rejects unsupported explicit adapters', () => {
  const repoDir = setupProject({ 'package.json': '{}' });
  const result = runAdapterResolve(repoDir, ['--adapter', 'python']);
  assert.equal(result.status, 1);
  assert.equal(result.json.ok, false);
  assert.equal(result.json.code, 'adapter-not-supported');
  assert.deepEqual(result.json.supportedAdapters, ['node']);
});

test('ask adapter resolve rejects unknown projects when no adapter can be resolved', () => {
  const repoDir = setupProject({ 'README.md': '# unknown\n' });
  const result = runAdapterResolve(repoDir);
  assert.equal(result.status, 1);
  assert.equal(result.json.ok, false);
  assert.equal(result.json.code, 'adapter-resolution-unknown-project');
  assert.equal(result.json.detection.projectType, 'unknown');
});
