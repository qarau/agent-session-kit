import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
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
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-agent-dispatch-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
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

async function startBridgeServer(options = {}) {
  const dispatches = new Map();
  const requestLog = {
    createCalls: 0,
    statusCalls: 0,
    cancelCalls: 0,
    statusByDispatchId: {},
  };

  const server = http.createServer((req, res) => {
    const method = String(req.method || 'GET').toUpperCase();
    const url = String(req.url || '/');
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += String(chunk || '');
    });
    req.on('end', () => {
      let body = {};
      try {
        body = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        body = {};
      }

      if (method === 'POST' && url === '/dispatches') {
        requestLog.createCalls += 1;
        const idempotencyKey = String(req.headers['x-idempotency-key'] || '');
        const existing = idempotencyKey ? dispatches.get(idempotencyKey) : null;
        if (existing) {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(existing.createResponse));
          return;
        }

        const createResult = options.onCreate
          ? options.onCreate({ requestLog, body, headers: req.headers })
          : null;
        const dispatchId = String(createResult?.dispatchId || `disp-${requestLog.createCalls}`);
        const createResponse = {
          ok: true,
          dispatchId,
          status: String(createResult?.status || 'queued'),
        };
        const state = {
          dispatchId,
          statuses: Array.isArray(createResult?.statuses) ? [...createResult.statuses] : ['queued', 'running', 'completed'],
          cursor: 0,
          codexAgentId: String(createResult?.codexAgentId || 'codex-agent-1'),
        };
        if (idempotencyKey) {
          dispatches.set(idempotencyKey, { ...state, createResponse });
        }
        dispatches.set(dispatchId, { ...state, createResponse });
        requestLog.statusByDispatchId[dispatchId] = [];
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify(createResponse));
        return;
      }

      if (method === 'GET' && url.startsWith('/dispatches/')) {
        requestLog.statusCalls += 1;
        const dispatchId = url.slice('/dispatches/'.length);
        const state = dispatches.get(dispatchId);
        if (!state) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'not-found' }));
          return;
        }
        const customStatus = options.onStatus
          ? options.onStatus({ requestLog, dispatchId, state })
          : null;
        const status = String(
          customStatus?.status
            || state.statuses[Math.min(state.cursor, state.statuses.length - 1)]
            || 'completed'
        );
        state.cursor = Math.min(state.cursor + 1, state.statuses.length - 1);
        requestLog.statusByDispatchId[dispatchId].push(status);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          dispatchId,
          status,
          exitCode: status === 'completed' ? 0 : status === 'failed' ? 1 : 0,
          codexAgentId: String(customStatus?.codexAgentId || state.codexAgentId || ''),
          artifacts: Array.isArray(customStatus?.artifacts) ? customStatus.artifacts : [],
        }));
        return;
      }

      if (method === 'POST' && url.startsWith('/dispatches/') && url.endsWith('/cancel')) {
        requestLog.cancelCalls += 1;
        const dispatchId = url.slice('/dispatches/'.length, -('/cancel'.length));
        const state = dispatches.get(dispatchId);
        if (state) {
          state.statuses = ['cancelled'];
          state.cursor = 0;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, dispatchId, status: 'cancelled' }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'unknown-route' }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    baseUrl: `http://localhost:${String(port)}`,
    requestLog,
    close: async () => {
      await new Promise(resolve => server.close(() => resolve()));
    },
  };
}

test('agent dispatch executes lifecycle and writes dispatch snapshot on dry-run success', () => {
  const repoDir = setupRepo();

  const result = runOrThrow(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-1',
      '--title',
      'Dispatch target',
      '--agent',
      'agent-dispatch',
      '--capabilities',
      'implementer',
      '--provider',
      'codex',
      '--dry-run',
    ],
    { cwd: repoDir }
  );

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.provider, 'codex');
  assert.equal(payload.dispatch.status, 'dry-run');
  assert.equal(payload.verificationOutcome, 'pass');

  const claims = readSnapshot(repoDir, 'claims.json');
  assert.equal(claims.tasks['task-1'].status, 'released');

  const verification = readSnapshot(repoDir, 'verification.json');
  assert.equal(verification.tasks['task-1'].status, 'passed');
  assert.equal(verification.tasks['task-1'].evidenceCount, 1);

  const childSessions = readSnapshot(repoDir, 'child-sessions.json');
  assert.equal(childSessions.tasks['task-1'].latest.agentId, 'agent-dispatch');
  assert.ok(childSessions.tasks['task-1'].latest.childSessionId.startsWith('task-1_child_'));

  const dispatch = readSnapshot(repoDir, 'subagent-dispatch.json');
  assert.equal(dispatch.tasks['task-1'].latest.status, 'completed');
  assert.equal(dispatch.tasks['task-1'].latest.executionStatus, 'dry-run');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('SubagentDispatchRequested'));
  assert.ok(eventTypes.includes('SubagentDispatchStarted'));
  assert.ok(eventTypes.includes('SubagentDispatchCompleted'));
  assert.ok(eventTypes.includes('TaskClaimReleased'));
  assert.ok(eventTypes.includes('EvidenceAttached'));
  assert.ok(eventTypes.includes('VerificationPassed'));
});

test('agent dispatch records failure lifecycle and verification fail for non-zero provider exit', () => {
  const repoDir = setupRepo();

  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-2',
      '--title',
      'Fail dispatch target',
      '--agent',
      'agent-failure',
      '--capabilities',
      'implementer',
      '--provider',
      'codex',
      '--provider-command',
      process.execPath,
      '--provider-arg',
      '-e',
      '--provider-arg',
      'process.exit(7)',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.dispatch.exitCode, 7);
  assert.equal(payload.verificationOutcome, 'fail');

  const claims = readSnapshot(repoDir, 'claims.json');
  assert.equal(claims.tasks['task-2'].status, 'released');

  const verification = readSnapshot(repoDir, 'verification.json');
  assert.equal(verification.tasks['task-2'].status, 'failed');
  assert.equal(verification.tasks['task-2'].evidenceCount, 1);

  const dispatch = readSnapshot(repoDir, 'subagent-dispatch.json');
  assert.equal(dispatch.tasks['task-2'].latest.status, 'failed');
  assert.equal(dispatch.tasks['task-2'].latest.executionStatus, 'failed');
  assert.equal(dispatch.tasks['task-2'].latest.exitCode, 7);

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('SubagentDispatchRequested'));
  assert.ok(eventTypes.includes('SubagentDispatchStarted'));
  assert.ok(eventTypes.includes('SubagentDispatchFailed'));
  assert.ok(eventTypes.includes('TaskClaimReleased'));
  assert.ok(eventTypes.includes('VerificationFailed'));
});

test('agent dispatch rejects unknown provider with deterministic error payload', () => {
  const repoDir = setupRepo();
  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-3',
      '--title',
      'Unknown provider target',
      '--agent',
      'agent-unknown',
      '--capabilities',
      'implementer',
      '--provider',
      'unknown-provider',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'unknown-provider');
  assert.equal(payload.provider, 'unknown-provider');
});

test('agent dispatch blocks claim scope mismatch before provider execution', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-4', '--title', 'Claim target'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'claim', 'lock', 'task-4', '--agent', 'agent-claim', '--scope', 'feature'], {
    cwd: repoDir,
  });

  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-4',
      '--agent',
      'agent-claim',
      '--capabilities',
      'implementer',
      '--scope',
      'task',
      '--dry-run',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'claim-scope-mismatch');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(!eventTypes.includes('SubagentDispatchRequested'));
});

test('agent dispatch enforces capability match before execution', () => {
  const repoDir = setupRepo();
  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-5',
      '--title',
      'Capability target',
      '--agent',
      'agent-capability',
      '--capabilities',
      'planner',
      '--dry-run',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'capability-mismatch');
  assert.equal(payload.requiredCapability, 'implementer');
});

test('agent dispatch enforces policy hold decision unless overridden', () => {
  const repoDir = setupRepo();
  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-6',
      '--title',
      'Policy hold target',
      '--agent',
      'agent-policy',
      '--capabilities',
      'reviewer',
      '--queue-class',
      'reviewer',
      '--dry-run',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'dispatch-held-by-policy');
  assert.equal(payload.queueClass, 'reviewer');
});

test('agent dispatch retries timed-out provider according to policy hooks', () => {
  const repoDir = setupRepo();
  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-7',
      '--title',
      'Timeout target',
      '--agent',
      'agent-timeout',
      '--capabilities',
      'implementer',
      '--provider-command',
      process.execPath,
      '--provider-arg',
      '-e',
      '--provider-arg',
      'setTimeout(() => process.exit(0), 120)',
      '--timeout-ms',
      '20',
      '--max-retries',
      '1',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.dispatch.status, 'timeout');

  const dispatch = readSnapshot(repoDir, 'subagent-dispatch.json');
  assert.equal(dispatch.tasks['task-7'].latest.status, 'failed');
  assert.equal(dispatch.tasks['task-7'].latest.executionStatus, 'timeout');
  assert.equal(dispatch.tasks['task-7'].latest.attempts, 2);

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('SubagentDispatchRetryScheduled'));
  assert.ok(eventTypes.includes('SubagentDispatchFailed'));
});

test('agent dispatch enforces promotion gates for release-critical integrator queue tasks', () => {
  const repoDir = setupRepo();
  runOrThrow(process.execPath, [askBinPath, 'task', 'create', 'task-8', '--title', 'Release critical task'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'feature', 'create', 'feature-1', '--title', 'Release Feature'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'feature', 'link-task', 'feature-1', '--task', 'task-8'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'release', 'create', 'train-1', '--title', 'Release Train'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'release', 'link-feature', 'train-1', '--feature', 'feature-1'], { cwd: repoDir });

  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-8',
      '--agent',
      'agent-release',
      '--capabilities',
      'implementer',
      '--queue-class',
      'integrator',
      '--dry-run',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'promotion-gates-unmet');
  assert.deepEqual(payload.releaseFeatureIds, ['feature-1']);
});

test('agent dispatch supports bridge lifecycle provider with start status completion flow', () => {
  const repoDir = setupRepo();
  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-13',
      '--title',
      'Bridge provider target',
      '--agent',
      'agent-bridge',
      '--capabilities',
      'implementer',
      '--provider',
      'codex-bridge',
      '--bridge-url',
      'mock://phase4-provider',
      '--bridge-mock-statuses',
      'queued,running,completed',
      '--bridge-mock-dispatch-id',
      'disp-bridge-1',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.dispatch.status, 'completed');
  assert.equal(payload.dispatch.dispatchId, 'disp-bridge-1');
});

test('agent dispatch resumes idempotent in-flight bridge dispatch via task child correlation', () => {
  const repoDir = setupRepo();

  const controlPath = path.join(repoDir, '.ask', 'runtime', 'snapshots', 'subagent-dispatch-control.json');
  fs.mkdirSync(path.dirname(controlPath), { recursive: true });
  fs.writeFileSync(
    controlPath,
    JSON.stringify(
      {
        tasks: {
          'task-14': {
            taskId: 'task-14',
            childSessionId: 'task-14_child_resume',
            provider: 'codex-bridge',
            dispatchId: 'disp-resume-1',
            idempotencyKey: 'task-14:task-14_child_resume',
            status: 'started',
            updatedAt: '2026-03-24T00:00:00.000Z',
          },
        },
      },
      null,
      2
    ),
    'utf8'
  );

  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-14',
      '--title',
      'Bridge resume target',
      '--agent',
      'agent-resume',
      '--capabilities',
      'implementer',
      '--provider',
      'codex-bridge',
      '--bridge-url',
      'mock://phase4-provider',
      '--bridge-mock-statuses',
      'completed',
      '--child',
      'task-14_child_resume',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.dispatch.status, 'completed');
  assert.equal(payload.dispatch.dispatchId, 'disp-resume-1');
});

test('agent dispatch redacts sensitive provider arguments from events and artifact payload', () => {
  const repoDir = setupRepo();
  const secretToken = 'token-secret-value';

  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-15',
      '--title',
      'Redaction target',
      '--agent',
      'agent-redact',
      '--capabilities',
      'implementer',
      '--provider',
      'codex',
      '--provider-command',
      'codex',
      '--provider-arg',
      `--token=${secretToken}`,
      '--provider-arg',
      '--safe=value',
      '--dry-run',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  const events = readEvents(repoDir);
  const started = events.find(event => event.type === 'SubagentDispatchStarted' && event.taskId === 'task-15');
  assert.ok(started);
  const serializedStarted = JSON.stringify(started);
  assert.ok(!serializedStarted.includes(secretToken), serializedStarted);
  assert.ok(serializedStarted.includes('[REDACTED]'), serializedStarted);

  const artifact = JSON.parse(fs.readFileSync(payload.artifactPath, 'utf8'));
  const serializedArtifact = JSON.stringify(artifact);
  assert.ok(!serializedArtifact.includes(secretToken), serializedArtifact);
});

test('agent dispatch enforces provider allowlist from policy pack', () => {
  const repoDir = setupRepo();
  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-16',
      '--title',
      'Allowlist target',
      '--agent',
      'agent-allowlist',
      '--capabilities',
      'integrator',
      '--required-capability',
      'integrator',
      '--queue-class',
      'integrator',
      '--provider',
      'codex',
      '--dry-run',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'provider-not-allowed');
});

test('agent dispatch requires structured override governance reason and approval metadata', () => {
  const repoDir = setupRepo();
  const result = run(
    process.execPath,
    [
      askBinPath,
      'agent',
      'dispatch',
      'task-17',
      '--title',
      'Override governance target',
      '--agent',
      'agent-governance',
      '--capabilities',
      'planner',
      '--allow-capability-override',
      '--capability-override-reason',
      'short',
      '--dry-run',
    ],
    { cwd: repoDir }
  );

  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'override-governance-invalid');
});
