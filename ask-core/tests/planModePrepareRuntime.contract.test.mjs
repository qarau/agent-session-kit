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

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-plan-mode-prepare-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  return repoDir;
}

test('plan-mode prepare writes canonical markdown and ASK plan JSON artifacts', () => {
  const repoDir = setupRepo();
  writeText(path.join(repoDir, 'incoming', 'feature-plan.md'), [
    '# Governed Feature Plan',
    '',
    '## Slice 001 - Prepare Runtime',
    '',
    'Create the prepare runtime.',
    '',
    'Acceptance criteria:',
    '',
    '- prepare command exists',
    '- json artifact validates',
    '',
    '## Slice 002 - Begin Runtime',
    '',
    'Start implementation through ASK.',
    '',
    'Acceptance criteria:',
    '',
    '- begin command exists',
  ].join('\n'));

  const result = run(process.execPath, [
    askBinPath,
    'plan-mode',
    'prepare',
    '--title',
    'Governed Feature Plan',
    '--source',
    'incoming/feature-plan.md',
    '--prefix',
    'gfp',
    '--date',
    '2026-05-09',
  ], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.markdownPath, 'docs/plans/2026-05-09-governed-feature-plan.md');
  assert.equal(payload.planJsonPath, 'docs/plans/2026-05-09-governed-feature-plan.plan.json');
  assert.match(payload.nextAction, /ask plan-mode handoff --title "Governed Feature Plan"/);
  assert.match(payload.nextAction, /--source docs\/plans\/2026-05-09-governed-feature-plan\.md/);
  assert.match(payload.nextAction, /--plan-json docs\/plans\/2026-05-09-governed-feature-plan\.plan\.json/);

  const markdown = fs.readFileSync(path.join(repoDir, payload.markdownPath), 'utf8');
  assert.match(markdown, /# Governed Feature Plan/);

  const plan = JSON.parse(fs.readFileSync(path.join(repoDir, payload.planJsonPath), 'utf8'));
  assert.equal(plan.schemaVersion, 2);
  assert.equal(plan.planPrefix, 'gfp');
  assert.equal(plan.planTitle, 'Governed Feature Plan');
  assert.equal(plan.slices.length, 2);
  assert.equal(plan.slices[0].sliceId, 'prepare-runtime');
  assert.deepEqual(plan.slices[0].acceptanceCriteria, ['prepare command exists', 'json artifact validates']);
  assert.deepEqual(plan.slices[1].dependsOn, ['prepare-runtime']);

  const handoff = runOrThrow(process.execPath, [
    askBinPath,
    'plan-mode',
    'handoff',
    '--title',
    'Governed Feature Plan',
    '--source',
    payload.markdownPath,
    '--plan-json',
    payload.planJsonPath,
    '--task',
    'governed-feature-plan',
    '--run-id',
    'prepare-contract-run',
  ], { cwd: repoDir });
  assert.deepEqual(JSON.parse(handoff.stdout).createdTaskIds, ['gfp-001', 'gfp-002']);
});
