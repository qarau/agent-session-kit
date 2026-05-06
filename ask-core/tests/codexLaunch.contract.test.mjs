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

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-codex-launch-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  return tempRoot;
}

function readEvents(repoDir) {
  const eventsPath = path.join(repoDir, '.ask', 'runtime', 'events.ndjson');
  const raw = fs.readFileSync(eventsPath, 'utf8').trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function writePolicy(repoDir, text) {
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  fs.writeFileSync(policyPath, text, 'utf8');
}

function readActiveSession(repoDir) {
  return JSON.parse(fs.readFileSync(path.join(repoDir, '.ask', 'sessions', 'active-session.json'), 'utf8'));
}

function readNextActions(repoDir) {
  return fs.readFileSync(path.join(repoDir, '.ask', 'continuity', 'next-actions.md'), 'utf8');
}

test('codex launch emits governed lifecycle events with strict payload fields', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const launched = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      'launch',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'contract-smoke',
      '--touched-file',
      'src/main.js',
    ],
    { cwd: repoDir }
  );
  const payload = JSON.parse(launched.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.exitCode, 0);

  const events = readEvents(repoDir);
  const types = events.map(event => event.type);
  assert.ok(types.includes('CodexGovernedLaunchStarted'));
  assert.ok(types.includes('CodexExecutionCaptured'));
  assert.ok(types.includes('CodexGovernedCheckpointCreated'));

  const captured = events.find(event => event.type === 'CodexExecutionCaptured');
  assert.ok(captured);
  assert.equal(typeof captured.sessionId, 'string');
  assert.equal(typeof captured.actor, 'string');
  assert.equal(typeof captured.payload.correlationId, 'string');
  assert.equal(captured.payload.operation, 'contract-smoke');
  assert.equal(captured.payload.command, process.execPath);
  assert.match(captured.payload.argsFingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(captured.payload.status, 'completed');
  assert.equal(captured.payload.exitCode, 0);
  assert.equal(typeof captured.payload.durationMs, 'number');
  assert.equal(captured.payload.durationMs >= 0, true);
  assert.match(captured.payload.startedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.match(captured.payload.endedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.deepEqual(captured.payload.touchedFiles, ['src/main.js']);
  assert.equal(captured.payload.failureCode, '');
  assert.equal(captured.meta.source, 'codex-launch-runtime');
  assert.equal(captured.meta.schemaVersion, 1);
});

test('ask codex defaults to governed launch when no explicit subcommand is provided', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const launched = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'default-governed-launch',
    ],
    { cwd: repoDir }
  );
  const payload = JSON.parse(launched.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.exitCode, 0);

  const events = readEvents(repoDir);
  assert.ok(events.some(event => event.type === 'CodexGovernedLaunchStarted'));
  assert.ok(events.some(event => event.type === 'CodexExecutionCaptured'));
});

test('codex launch is fail-closed on preflight gate failure by default', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: false
  require_tests_before_commit: false
`
  );

  const blocked = run(
    process.execPath,
    [
      askBinPath,
      'codex',
      'launch',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'blocked-smoke',
    ],
    { cwd: repoDir }
  );
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  const payload = JSON.parse(blocked.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'preflight-failed');
  assert.equal(Array.isArray(payload.missing), true);
  assert.ok(payload.missing.some(item => item.includes('session state active not allowed for preflight')));

  const events = readEvents(repoDir);
  const types = events.map(event => event.type);
  assert.ok(types.includes('CodexGovernedLaunchBlocked'));
  assert.equal(types.includes('CodexExecutionCaptured'), false);
});

test('codex launch can run fail-open when explicitly requested', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: false
  require_tests_before_commit: false

codex_runtime:
  allow_fail_open_launch: true
  require_fail_open_reason: true
  fail_open_reason_min_length: 10
  require_fail_open_approval: true
  require_fail_open_approval_ticket: true
`
  );

  const launched = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      'launch',
      '--allow-fail-open',
      '--fail-open-reason',
      'context recovery needed',
      '--approved-by',
      'maintainer-oncall',
      '--approval-ticket',
      'INC-4521',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'fail-open-smoke',
    ],
    { cwd: repoDir }
  );
  const payload = JSON.parse(launched.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.blockedByPreflight, true);

  const events = readEvents(repoDir);
  const types = events.map(event => event.type);
  assert.ok(types.includes('CodexLaunchFailOpenOverrideLogged'));
  assert.ok(types.includes('CodexGovernedLaunchStarted'));
  assert.ok(types.includes('CodexExecutionCaptured'));
  assert.ok(types.includes('CodexGovernedCheckpointCreated'));
});

test('codex launch does not allow fail-open override unless policy explicitly enables it', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: false
  require_tests_before_commit: false
`
  );

  const blocked = run(
    process.execPath,
    [
      askBinPath,
      'codex',
      '--allow-fail-open',
      '--fail-open-reason',
      'recovery attempt needed',
      '--approved-by',
      'maintainer-oncall',
      '--approval-ticket',
      'INC-4522',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
    ],
    { cwd: repoDir }
  );
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  const payload = JSON.parse(blocked.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'preflight-failed');
});

test('codex direct launch is blocked unless exception policy allows it', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const blocked = run(
    process.execPath,
    [
      askBinPath,
      'codex',
      'direct',
      '--reason',
      'hotfix',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
    ],
    { cwd: repoDir }
  );
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  const payload = JSON.parse(blocked.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'direct-launch-disallowed');

  const events = readEvents(repoDir);
  assert.ok(events.some(event => event.type === 'CodexDirectLaunchBlocked'));
});

test('codex direct launch requires reason when exception policy is enabled', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: false
  require_tests_before_commit: false

codex_runtime:
  governed_launch_default: true
  allow_fail_open_launch: false
  allow_direct_launch_exception: true
  require_direct_launch_reason: true
  direct_launch_reason_min_length: 10
  require_direct_launch_approval: true
  require_direct_launch_approval_ticket: true
`
  );

  const blocked = run(
    process.execPath,
    [
      askBinPath,
      'codex',
      'direct',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'direct-missing-reason',
    ],
    { cwd: repoDir }
  );
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  const payload = JSON.parse(blocked.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'override-governance-invalid');
});

test('codex direct launch runs when exception policy allows it and reason is provided', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: false
  require_tests_before_commit: false

codex_runtime:
  governed_launch_default: true
  allow_fail_open_launch: false
  allow_direct_launch_exception: true
  require_direct_launch_reason: true
  direct_launch_reason_min_length: 10
  require_direct_launch_approval: true
  require_direct_launch_approval_ticket: true
`
  );

  const launched = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      'direct',
      '--reason',
      'incident-recovery',
      '--approved-by',
      'maintainer-oncall',
      '--approval-ticket',
      'INC-9876',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'direct-allowed',
    ],
    { cwd: repoDir }
  );
  const payload = JSON.parse(launched.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.mode, 'direct-exception');

  const events = readEvents(repoDir);
  assert.ok(events.some(event => event.type === 'CodexDirectLaunchApproved'));
  const captured = events.find(event => event.type === 'CodexExecutionCaptured');
  assert.equal(captured.payload.launchMode, 'direct-exception');
  assert.equal(captured.payload.reason, 'incident-recovery');
});

test('codex launch captures timeout status and timeout failure code', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const timedOut = run(
    process.execPath,
    [
      askBinPath,
      'codex',
      'launch',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'setTimeout(() => process.exit(0), 300)',
      '--timeout-ms',
      '50',
      '--operation',
      'timeout-smoke',
    ],
    { cwd: repoDir }
  );
  assert.equal(timedOut.status, 1, timedOut.stdout + timedOut.stderr);
  const payload = JSON.parse(timedOut.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.exitCode, 124);

  const events = readEvents(repoDir);
  const captured = events.find(event => event.type === 'CodexExecutionCaptured');
  assert.equal(captured.payload.operation, 'timeout-smoke');
  assert.equal(captured.payload.status, 'timeout');
  assert.equal(captured.payload.failureCode, 'command-timeout');
});

test('codex launch auto-captures touched files when command mutates workspace', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  const launched = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      'launch',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'require("node:fs").writeFileSync("autotouched.txt","ok")',
      '--operation',
      'touch-smoke',
    ],
    { cwd: repoDir }
  );
  const payload = JSON.parse(launched.stdout);
  assert.equal(payload.ok, true);

  const events = readEvents(repoDir);
  const captured = events.find(event => event.type === 'CodexExecutionCaptured');
  assert.ok(captured.payload.touchedFiles.includes('autotouched.txt'));
});

test('codex launch recovers pending session transition continuity before execution', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'pause', '--reason', 'pause-before-restart-smoke'], { cwd: repoDir });

  const pausedSession = readActiveSession(repoDir);
  const recoveredAt = '2026-05-07T00:00:00.000Z';
  const recoveryTransition = {
    sessionId: pausedSession.sessionId,
    from: 'paused',
    to: 'resumed',
    at: recoveredAt,
    reason: 'resume after interruption',
    actor: pausedSession.actorId || 'local',
    branch: pausedSession.branch,
    worktree: pausedSession.worktree,
    repoRoot: pausedSession.repoRoot,
    sourceCommand: 'session resume',
  };

  fs.appendFileSync(
    path.join(repoDir, '.ask', 'sessions', 'history.ndjson'),
    `${JSON.stringify(recoveryTransition)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(repoDir, '.ask', 'sessions', 'pending-transition.json'),
    JSON.stringify(recoveryTransition, null, 2),
    'utf8'
  );

  const launched = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      'launch',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'continuity-restart-smoke',
    ],
    { cwd: repoDir }
  );
  const payload = JSON.parse(launched.stdout);
  assert.equal(payload.ok, true);

  const pendingPath = path.join(repoDir, '.ask', 'sessions', 'pending-transition.json');
  assert.equal(fs.existsSync(pendingPath), false);
  const sessionAfter = readActiveSession(repoDir);
  assert.equal(sessionAfter.status, 'active');

  const events = readEvents(repoDir);
  const started = events.find(event => event.type === 'CodexGovernedLaunchStarted');
  assert.equal(started.sessionId, pausedSession.sessionId);
});

test('codex checkpoint persists next-action continuity marker', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });

  runOrThrow(
    process.execPath,
    [
      askBinPath,
      'codex',
      'launch',
      '--command',
      process.execPath,
      '--command-arg',
      '-e',
      '--command-arg',
      'process.exit(0)',
      '--operation',
      'checkpoint-next-action-smoke',
    ],
    { cwd: repoDir }
  );

  const nextActions = readNextActions(repoDir);
  assert.match(nextActions, /<!-- codex-checkpoint -->/u);
  assert.match(nextActions, /checkpoint-next-action-smoke/u);
});
