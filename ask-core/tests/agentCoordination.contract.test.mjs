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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-agent-coordination-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-1', '--title', 'Coordination target'], { cwd: repoDir });
  return repoDir;
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

function readSnapshot(repoDir, name) {
  return JSON.parse(fs.readFileSync(path.join(repoDir, '.ask', 'runtime', 'snapshots', name), 'utf8'));
}

test('route recommend selects agent using capability policy', () => {
  const repoDir = setupRepo();

  runOrThrow(process.execPath, [askBinPath, 'agent', 'register', 'agent-planner', '--capabilities', 'planner'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'agent', 'register', 'agent-impl', '--capabilities', 'implementer,verifier'], {
    cwd: repoDir,
  });

  const recommended = runOrThrow(process.execPath, [askBinPath, 'route', 'recommend', 'task-1'], { cwd: repoDir });
  const payload = JSON.parse(recommended.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.recommendation.agentId, 'agent-planner');
  assert.equal(payload.recommendation.requiredCapability, 'planner');
  assert.equal(payload.recommendation.policy, 'status-based-routing');

  const routing = readSnapshot(repoDir, 'routing.json');
  assert.equal(routing.tasks['task-1'].latestRecommendation.agentId, 'agent-planner');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('AgentRegistered'));
  assert.ok(eventTypes.includes('RouteRecommended'));
});

test('claim acquire release lock scope emits expected lifecycle events', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'agent', 'register', 'agent-claim', '--capabilities', 'implementer'], {
    cwd: repoDir,
  });

  const acquired = runOrThrow(process.execPath, [askBinPath, 'claim', 'acquire', 'task-1', '--agent', 'agent-claim', '--scope', 'task'], {
    cwd: repoDir,
  });
  const locked = runOrThrow(process.execPath, [askBinPath, 'claim', 'lock', 'task-1', '--agent', 'agent-claim', '--scope', 'worktree'], {
    cwd: repoDir,
  });
  const released = runOrThrow(process.execPath, [askBinPath, 'claim', 'release', 'task-1', '--agent', 'agent-claim', '--scope', 'task'], {
    cwd: repoDir,
  });

  assert.equal(JSON.parse(acquired.stdout).ok, true);
  assert.equal(JSON.parse(locked.stdout).ok, true);
  assert.equal(JSON.parse(released.stdout).ok, true);

  const claims = readSnapshot(repoDir, 'claims.json');
  assert.equal(claims.tasks['task-1'].status, 'released');
  assert.equal(claims.tasks['task-1'].lastAgentId, 'agent-claim');
  assert.equal(claims.tasks['task-1'].lastScope, 'task');
  assert.equal(claims.tasks['task-1'].lock.scope, 'worktree');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('TaskClaimAcquired'));
  assert.ok(eventTypes.includes('TaskClaimLocked'));
  assert.ok(eventTypes.includes('TaskClaimReleased'));
});

test('task spawn creates child session with agent linkage', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'agent', 'register', 'agent-child', '--capabilities', 'implementer'], {
    cwd: repoDir,
  });

  const spawned = runOrThrow(
    process.execPath,
    [askBinPath, 'child-session', 'spawn', 'task-1', '--agent', 'agent-child', '--child', 'child-1'],
    { cwd: repoDir }
  );
  const payload = JSON.parse(spawned.stdout);

  assert.equal(payload.ok, true);
  assert.equal(payload.childSession.childSessionId, 'child-1');
  assert.equal(payload.childSession.agentId, 'agent-child');

  const childSessions = readSnapshot(repoDir, 'child-sessions.json');
  assert.equal(childSessions.tasks['task-1'].latest.childSessionId, 'child-1');
  assert.equal(childSessions.tasks['task-1'].latest.agentId, 'agent-child');

  const agents = readSnapshot(repoDir, 'agents.json');
  assert.ok(agents.agents['agent-child'].childSessions.includes('child-1'));

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('ChildSessionCreated'));
});
