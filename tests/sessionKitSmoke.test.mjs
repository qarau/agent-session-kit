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

test('maintainer dogfooding assets exist in repository root', () => {
  assert.equal(fs.existsSync(path.join(kitRoot, '.githooks', 'pre-commit')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, '.githooks', 'pre-push')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'scripts', 'session', 'runAskCorePreCommitAdapter.mjs')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'scripts', 'session', 'runAskCorePrePushAdapter.mjs')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'ask-core', 'bin', 'ask.js')), true);
});

test('documentation describes branch-aware maintainer mode policy', () => {
  const readme = fs.readFileSync(path.join(kitRoot, 'README.md'), 'utf8');
  assert.match(readme, /ASK 2\.0/i);

  const maintainerModePath = path.join(kitRoot, 'docs', 'maintainer-mode.md');
  assert.equal(fs.existsSync(maintainerModePath), true);
  const maintainerMode = fs.readFileSync(maintainerModePath, 'utf8');
  assert.match(maintainerMode, /protected-branch.*fail-closed/i);
  assert.match(maintainerMode, /branchEnforcementMode:\s*"all"/i);
  assert.match(maintainerMode, /docs\/ASK_Runtime\/\*.*local-only/i);
  assert.match(maintainerMode, /verification evidence/i);
});

test('agent-session-kit installs ask-core runtime-only flow in a temp repo', () => {
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

  assert.equal(
    fs.existsSync(path.join(repoDir, 'scripts', 'session', 'runAskCorePreCommitAdapter.mjs')),
    true,
    'pre-commit adapter wrapper should be installed'
  );
  assert.equal(
    fs.existsSync(path.join(repoDir, 'scripts', 'session', 'runAskCorePrePushAdapter.mjs')),
    true,
    'pre-push adapter wrapper should be installed'
  );
  assert.equal(
    fs.existsSync(path.join(repoDir, 'ask-core', 'bin', 'ask.js')),
    true,
    'ask-core runtime should be installed'
  );

  assert.equal(
    fs.existsSync(path.join(repoDir, 'scripts', 'session', 'verifyWorkContext.mjs')),
    false,
    'legacy work-context validator should not be installed'
  );
  assert.equal(
    fs.existsSync(path.join(repoDir, 'scripts', 'session', 'verifySessionDocsFreshness.mjs')),
    false,
    'legacy docs-freshness validator should not be installed'
  );
  assert.equal(
    fs.existsSync(path.join(repoDir, 'scripts', 'session', 'verifyReleaseDocsConsistency.mjs')),
    false,
    'legacy release-doc validator should not be installed'
  );

  const hooksPath = runOrThrow('git', ['config', '--get', 'core.hooksPath'], { cwd: repoDir });
  assert.equal(hooksPath.stdout.trim(), '.githooks');

  const preCommitResult = run(process.execPath, ['scripts/session/runAskCorePreCommitAdapter.mjs'], {
    cwd: repoDir,
  });
  assert.equal(preCommitResult.status, 0, preCommitResult.stdout + preCommitResult.stderr);

  const prePushResult = run(process.execPath, ['scripts/session/runAskCorePrePushAdapter.mjs'], {
    cwd: repoDir,
  });
  assert.equal(prePushResult.status, 0, prePushResult.stdout + prePushResult.stderr);
});
