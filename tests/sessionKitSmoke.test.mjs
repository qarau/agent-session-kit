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
const installerPath = path.join(kitRoot, 'install-session-kit.mjs');

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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('agent-session-kit installs and enforces context/freshness in a temp repo', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-session-kit-smoke-'));
  const repoDir = path.join(tempRoot, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'smoke@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Smoke Test'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'session-kit-smoke'], { cwd: repoDir });

  const installResult = runOrThrow(
    process.execPath,
    [
      installerPath,
      '--target',
      repoDir,
      '--branch',
      'session-kit-smoke',
      '--repo-suffix',
      path.basename(repoDir),
      '--enforce-path-suffix',
      'true',
    ],
    { cwd: kitRoot }
  );
  assert.match(installResult.stdout, /Agent Session Kit install complete\./);

  const configPath = path.join(repoDir, 'docs', 'session', 'active-work-context.json');
  const tasksPath = path.join(repoDir, 'docs', 'session', 'tasks.md');
  assert.equal(fs.existsSync(tasksPath), true, 'tasks.md should be installed');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.expectedBranch, 'session-kit-smoke');
  assert.equal(config.enforceRepoPathSuffix, true);
  const altConfigPath = path.join(repoDir, 'docs', 'session', 'active-work-context.alt.json');
  writeJson(altConfigPath, config);

  const contextPass = run(
    process.execPath,
    ['scripts/session/verifyWorkContext.mjs', '--mode', 'pre-commit', '--config', 'docs/session/active-work-context.alt.json'],
    { cwd: repoDir }
  );
  assert.equal(contextPass.status, 0, contextPass.stdout + contextPass.stderr);
  assert.match(contextPass.stdout, /\[work-context:pre-commit\] OK/);
  assert.match(contextPass.stdout, /active-work-context\.alt\.json/);

  writeJson(configPath, {
    ...config,
    expectedBranch: 'wrong-branch',
  });
  const contextFail = run(
    process.execPath,
    ['scripts/session/verifyWorkContext.mjs', '--mode', 'preflight', '--config', 'docs/session/active-work-context.json'],
    { cwd: repoDir }
  );
  assert.equal(contextFail.status, 1);
  assert.match(contextFail.stderr, /Branch mismatch/);

  writeJson(configPath, config);

  const featurePath = path.join(repoDir, 'src', 'feature.txt');
  fs.mkdirSync(path.dirname(featurePath), { recursive: true });
  fs.writeFileSync(featurePath, 'meaningful change\n');
  runOrThrow('git', ['add', 'src/feature.txt'], { cwd: repoDir });

  const freshnessFail = run(
    process.execPath,
    ['scripts/session/verifySessionDocsFreshness.mjs', '--mode', 'pre-commit'],
    { cwd: repoDir }
  );
  assert.equal(freshnessFail.status, 1);
  assert.match(freshnessFail.stderr, /\[session-freshness:pre-commit\] guard failed/);
  assert.match(freshnessFail.stderr, /Missing required docs/);

  fs.appendFileSync(path.join(repoDir, 'docs', 'session', 'current-status.md'), '\nsmoke update\n');
  fs.appendFileSync(path.join(repoDir, 'docs', 'session', 'change-log.md'), '\nsmoke update\n');
  runOrThrow('git', ['add', 'docs/session/current-status.md', 'docs/session/change-log.md'], {
    cwd: repoDir,
  });

  const freshnessPass = run(
    process.execPath,
    ['scripts/session/verifySessionDocsFreshness.mjs', '--mode', 'pre-commit'],
    { cwd: repoDir }
  );
  assert.equal(freshnessPass.status, 0, freshnessPass.stdout + freshnessPass.stderr);
  assert.match(freshnessPass.stdout, /\[session-freshness:pre-commit\] OK/);
});
