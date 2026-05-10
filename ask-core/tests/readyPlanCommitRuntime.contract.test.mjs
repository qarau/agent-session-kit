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

function writeJson(filePath, payload) {
  writeText(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ready-plan-commit-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow('git', ['add', '.'], { cwd: repoDir });
  runOrThrow('git', ['commit', '-m', 'baseline'], { cwd: repoDir });
  return repoDir;
}

test('ready-plan commit commits only prepared plan artifacts with ASK-Plan provenance', () => {
  const repoDir = setupRepo();
  writeText(path.join(repoDir, 'docs', 'plans', '2026-05-09-runtime-plan.md'), '# Runtime Plan\n');
  writeJson(path.join(repoDir, 'docs', 'plans', '2026-05-09-runtime-plan.plan.json'), {
    schemaVersion: 2,
    planPrefix: 'rtp',
    planTitle: 'Runtime Plan',
    slices: [
      {
        sliceId: 'runtime',
        title: 'Runtime',
        description: 'Runtime work.',
      },
    ],
  });
  writeText(path.join(repoDir, 'src', 'unrelated.js'), 'export const unrelated = true;\n');

  const result = runOrThrow(process.execPath, [
    askBinPath,
    'ready-plan',
    'commit',
    '--title',
    'Runtime Plan',
    '--source',
    'docs/plans/2026-05-09-runtime-plan.md',
    '--plan-json',
    'docs/plans/2026-05-09-runtime-plan.plan.json',
  ], { cwd: repoDir });
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.committed, true);
  assert.equal(payload.planId, 'runtime-plan');
  assert.equal(payload.markdownPath, 'docs/plans/2026-05-09-runtime-plan.md');
  assert.equal(payload.planJsonPath, 'docs/plans/2026-05-09-runtime-plan.plan.json');
  assert.equal(payload.footer, 'ASK-Plan: runtime-plan');

  const commitFiles = runOrThrow('git', ['show', '--name-only', '--pretty=format:', payload.commit.sha], { cwd: repoDir })
    .stdout
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);
  assert.deepEqual(commitFiles, [
    'docs/plans/2026-05-09-runtime-plan.md',
    'docs/plans/2026-05-09-runtime-plan.plan.json',
  ]);

  const commitMessage = runOrThrow('git', ['log', '-1', '--pretty=%B'], { cwd: repoDir }).stdout;
  assert.match(commitMessage, /chore\(plan\): ready Runtime Plan/);
  assert.match(commitMessage, /ASK-Plan:\s*runtime-plan/);
  assert.match(commitMessage, /ASK-Plan-Markdown:\s*docs\/plans\/2026-05-09-runtime-plan\.md/);
  assert.match(commitMessage, /ASK-Plan-JSON:\s*docs\/plans\/2026-05-09-runtime-plan\.plan\.json/);

  const status = runOrThrow('git', ['status', '--short'], { cwd: repoDir }).stdout;
  assert.match(status, /\?\? src\//);
  assert.equal(fs.existsSync(path.join(repoDir, 'src', 'unrelated.js')), true);

  const rerun = runOrThrow(process.execPath, [
    askBinPath,
    'ready-plan',
    'commit',
    '--title',
    'Runtime Plan',
    '--source',
    'docs/plans/2026-05-09-runtime-plan.md',
    '--plan-json',
    'docs/plans/2026-05-09-runtime-plan.plan.json',
  ], { cwd: repoDir });
  const rerunPayload = JSON.parse(rerun.stdout);
  assert.equal(rerunPayload.ok, true);
  assert.equal(rerunPayload.committed, false);
  assert.equal(rerunPayload.commit.sha, payload.commit.sha);
});

test('ready-plan commit rejects paths outside docs/plans', () => {
  const repoDir = setupRepo();
  writeText(path.join(repoDir, 'plans', 'runtime-plan.md'), '# Runtime Plan\n');
  writeJson(path.join(repoDir, 'plans', 'runtime-plan.plan.json'), {
    schemaVersion: 2,
    planPrefix: 'rtp',
    planTitle: 'Runtime Plan',
    slices: [{ title: 'Runtime' }],
  });

  const result = run(process.execPath, [
    askBinPath,
    'ready-plan',
    'commit',
    '--title',
    'Runtime Plan',
    '--source',
    'plans/runtime-plan.md',
    '--plan-json',
    'plans/runtime-plan.plan.json',
  ], { cwd: repoDir });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).code, 'ready-plan-path-outside-docs-plans');
});
