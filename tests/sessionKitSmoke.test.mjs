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

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('maintainer dogfooding assets exist in repository root', () => {
  assert.equal(fs.existsSync(path.join(kitRoot, '.githooks', 'pre-commit')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, '.githooks', 'pre-push')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'docs', 'session', 'active-work-context.json')), true);
  assert.equal(fs.existsSync(path.join(kitRoot, 'docs', 'session', 'current-status.md')), true);
});

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
  const setRepoLockScriptPath = path.join(repoDir, 'scripts', 'session', 'setRepoWorkContextLock.mjs');
  const clearRepoLockScriptPath = path.join(repoDir, 'scripts', 'session', 'clearRepoWorkContextLock.mjs');
  const resumeSessionScriptPath = path.join(repoDir, 'scripts', 'session', 'resumeSession.mjs');
  const archiveSessionLogScriptPath = path.join(repoDir, 'scripts', 'session', 'archiveSessionLog.mjs');
  const nextTaskScriptPath = path.join(repoDir, 'scripts', 'session', 'nextTask.mjs');
  const completeTaskScriptPath = path.join(repoDir, 'scripts', 'session', 'completeTask.mjs');
  const tasksPath = path.join(repoDir, 'docs', 'session', 'tasks.md');
  const sessionChangeLogPath = path.join(repoDir, 'docs', 'session', 'change-log.md');
  assert.equal(fs.existsSync(tasksPath), true, 'tasks.md should be installed');
  assert.equal(fs.existsSync(setRepoLockScriptPath), true, 'setRepoWorkContextLock.mjs should be installed');
  assert.equal(fs.existsSync(clearRepoLockScriptPath), true, 'clearRepoWorkContextLock.mjs should be installed');
  assert.equal(fs.existsSync(resumeSessionScriptPath), true, 'resumeSession.mjs should be installed');
  assert.equal(fs.existsSync(archiveSessionLogScriptPath), true, 'archiveSessionLog.mjs should be installed');
  assert.equal(fs.existsSync(nextTaskScriptPath), true, 'nextTask.mjs should be installed');
  assert.equal(fs.existsSync(completeTaskScriptPath), true, 'completeTask.mjs should be installed');
  const resumeResult = run(process.execPath, ['scripts/session/resumeSession.mjs'], { cwd: repoDir });
  assert.equal(resumeResult.status, 0, resumeResult.stdout + resumeResult.stderr);
  assert.match(resumeResult.stdout, /Current branch:/);

  fs.writeFileSync(
    tasksPath,
    `# Session Tasks

Last updated: 2026-03-10

## Now

- [ ] current-task

## Next

- [ ] next-task-a
- [ ] next-task-b

## Done

- [x] 2026-03-09 - old-task
`
  );
  const nextTaskResult = run(process.execPath, ['scripts/session/nextTask.mjs'], { cwd: repoDir });
  assert.equal(nextTaskResult.status, 0, nextTaskResult.stdout + nextTaskResult.stderr);
  assert.match(nextTaskResult.stdout, /Recommended next task: current-task/);

  const completeTaskResult = run(process.execPath, ['scripts/session/completeTask.mjs'], {
    cwd: repoDir,
  });
  assert.equal(completeTaskResult.status, 0, completeTaskResult.stdout + completeTaskResult.stderr);
  assert.match(completeTaskResult.stdout, /Completed task: current-task/);
  assert.match(completeTaskResult.stdout, /Recommended next task: next-task-a/);
  const updatedTasks = fs.readFileSync(tasksPath, 'utf8');
  assert.match(updatedTasks, /## Now[\s\S]*- \[ \] next-task-a/);
  assert.match(updatedTasks, /## Done[\s\S]*- \[x\] \d{4}-\d{2}-\d{2} - current-task/);

  fs.writeFileSync(
    sessionChangeLogPath,
    `# Session Change Log

## 2026-03-10

- latest

## 2026-03-09

- older
`
  );
  const archiveResult = run(
    process.execPath,
    ['scripts/session/archiveSessionLog.mjs', '--keep-sections', '1'],
    { cwd: repoDir }
  );
  assert.equal(archiveResult.status, 0, archiveResult.stdout + archiveResult.stderr);

  const archivedChangeLog = fs.readFileSync(sessionChangeLogPath, 'utf8');
  assert.match(archivedChangeLog, /## 2026-03-10/);
  assert.doesNotMatch(archivedChangeLog, /## 2026-03-09/);
  const monthlyArchivePath = path.join(repoDir, 'docs', 'session', 'archive', 'change-log-2026-03.md');
  assert.equal(fs.existsSync(monthlyArchivePath), true, 'monthly archive should be created');
  const monthlyArchive = fs.readFileSync(monthlyArchivePath, 'utf8');
  assert.match(monthlyArchive, /## 2026-03-09/);

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

  runOrThrow(
    process.execPath,
    [
      'scripts/session/setRepoWorkContextLock.mjs',
      '--branch',
      'wrong-locked-branch',
      '--repo-suffix',
      path.basename(repoDir),
      '--enforce-path-suffix',
      'true',
    ],
    { cwd: repoDir }
  );
  const repoLockedFail = run(
    process.execPath,
    ['scripts/session/verifyWorkContext.mjs', '--mode', 'pre-commit', '--config', 'docs/session/active-work-context.alt.json'],
    { cwd: repoDir }
  );
  assert.equal(repoLockedFail.status, 1);
  assert.match(repoLockedFail.stderr, /wrong-locked-branch/);

  runOrThrow(
    process.execPath,
    [
      'scripts/session/setRepoWorkContextLock.mjs',
      '--branch',
      'session-kit-smoke',
      '--repo-suffix',
      path.basename(repoDir),
      '--enforce-path-suffix',
      'true',
    ],
    { cwd: repoDir }
  );
  const repoLockedPass = run(
    process.execPath,
    ['scripts/session/verifyWorkContext.mjs', '--mode', 'pre-commit', '--config', 'docs/session/active-work-context.alt.json'],
    { cwd: repoDir }
  );
  assert.equal(repoLockedPass.status, 0, repoLockedPass.stdout + repoLockedPass.stderr);

  runOrThrow(process.execPath, ['scripts/session/clearRepoWorkContextLock.mjs'], { cwd: repoDir });
  const clearedRepoLockPass = run(
    process.execPath,
    ['scripts/session/verifyWorkContext.mjs', '--mode', 'pre-commit', '--config', 'docs/session/active-work-context.alt.json'],
    { cwd: repoDir }
  );
  assert.equal(clearedRepoLockPass.status, 0, clearedRepoLockPass.stdout + clearedRepoLockPass.stderr);

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

  const freshnessAdvisory = run(
    process.execPath,
    ['scripts/session/verifySessionDocsFreshness.mjs', '--mode', 'pre-commit'],
    { cwd: repoDir }
  );
  assert.equal(freshnessAdvisory.status, 0, freshnessAdvisory.stdout + freshnessAdvisory.stderr);
  assert.match(`${freshnessAdvisory.stdout}\n${freshnessAdvisory.stderr}`, /advisory mode/i);

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

  const strictTasksAdvisory = run(
    process.execPath,
    ['scripts/session/verifySessionDocsFreshness.mjs', '--mode', 'pre-commit'],
    {
      cwd: repoDir,
      env: { SESSION_TASKS_STRICT: '1' },
    }
  );
  assert.equal(
    strictTasksAdvisory.status,
    0,
    strictTasksAdvisory.stdout + strictTasksAdvisory.stderr
  );
  assert.match(`${strictTasksAdvisory.stdout}\n${strictTasksAdvisory.stderr}`, /advisory mode/i);

  fs.appendFileSync(tasksPath, '\n- [x] smoke strict task update\n');
  runOrThrow('git', ['add', 'docs/session/tasks.md'], { cwd: repoDir });
  const strictTasksPass = run(
    process.execPath,
    ['scripts/session/verifySessionDocsFreshness.mjs', '--mode', 'pre-commit'],
    {
      cwd: repoDir,
      env: { SESSION_TASKS_STRICT: '1' },
    }
  );
  assert.equal(strictTasksPass.status, 0, strictTasksPass.stdout + strictTasksPass.stderr);
});
