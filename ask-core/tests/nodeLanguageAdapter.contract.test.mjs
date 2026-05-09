import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createNodeLanguageAdapter,
  detectNodeProject,
  detectPackageManager,
} from '../src/adapters/language/node/index.js';

function setupProject(files = {}) {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-node-adapter-'));
  for (const [filePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(repoDir, filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents, 'utf8');
  }
  return repoDir;
}

test('node language adapter exposes stable metadata and command descriptors', () => {
  const adapter = createNodeLanguageAdapter();
  assert.equal(adapter.adapterId, 'node');
  assert.equal(adapter.languageId, 'node');
  assert.equal(adapter.displayName, 'Node.js / JavaScript / TypeScript');
  assert.ok(adapter.capabilities.includes('detect'));
  assert.ok(adapter.capabilities.includes('typecheck'));
  assert.ok(adapter.capabilities.includes('test'));
  assert.deepEqual(adapter.commands.typecheck, { command: 'npm', args: ['run', 'typecheck'] });
  assert.deepEqual(adapter.commands.test, { command: 'npm', args: ['test'] });
  assert.deepEqual(adapter.commands.build, { command: 'npm', args: ['run', 'build'] });
});

test('node project detection identifies TypeScript projects from tsconfig', () => {
  const repoDir = setupProject({
    'package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
    'tsconfig.json': '{}',
    'package-lock.json': '{}',
  });
  const result = detectNodeProject(repoDir);
  assert.equal(result.ok, true);
  assert.equal(result.projectType, 'node-typescript');
  assert.equal(result.adapterId, 'node');
  assert.equal(result.profileId, 'node-typescript');
  assert.equal(result.packageManager, 'npm');
  assert.ok(result.evidence.includes('tsconfig.json'));
});

test('node project detection identifies JavaScript projects without TypeScript signals', () => {
  const repoDir = setupProject({
    'package.json': JSON.stringify({ scripts: { test: 'node --test' } }),
  });
  const result = detectNodeProject(repoDir);
  assert.equal(result.ok, true);
  assert.equal(result.projectType, 'node-javascript');
  assert.equal(result.profileId, 'node-javascript');
  assert.equal(result.confidence, 'medium');
});

test('node project detection returns stable unknown result outside node projects', () => {
  const repoDir = setupProject({ 'README.md': '# not node\n' });
  const result = detectNodeProject(repoDir);
  assert.equal(result.ok, true);
  assert.equal(result.projectType, 'unknown');
  assert.equal(result.languageId, '');
  assert.equal(result.adapterId, '');
  assert.equal(result.packageManager, 'unknown');
});

test('package manager detection uses stable lockfile precedence', () => {
  const repoDir = setupProject({
    'package.json': '{}',
    'package-lock.json': '{}',
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'yarn.lock': '',
  });
  const result = detectPackageManager(repoDir);
  assert.equal(result.packageManager, 'pnpm');
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /multiple package manager lockfiles/i);
});
