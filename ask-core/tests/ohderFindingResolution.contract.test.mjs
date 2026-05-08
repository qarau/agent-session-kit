import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { AskPaths } from '../src/fs/AskPaths.js';
import { FileStore } from '../src/fs/FileStore.js';
import { EventLedger } from '../src/runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../src/runtime/RuntimeProjectionEngine.js';
import { FindingFingerprintEngine } from '../src/core/FindingFingerprintEngine.js';
import { FindingResolutionRuntime } from '../src/core/FindingResolutionRuntime.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

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
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      `status=${String(result.status)}`,
      result.stdout,
      result.stderr,
    ].join('\n'));
  }
  return result;
}

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ofrr-'));
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
  if (!fs.existsSync(eventsPath)) {
    return [];
  }
  return fs.readFileSync(eventsPath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function semanticFact(overrides = {}) {
  return {
    metric: 'security_boundary',
    value: 'invalid',
    confidence: 'high',
    severity: 'critical',
    source: 'OhderSecurityBoundaryAnalyzerEngine',
    evidence: [
      {
        filePath: 'ask-core/src/core/SecurityRuntime.js',
        reason: 'auth bypass signal detected',
      },
    ],
    recommendations: ['Add explicit security tests.'],
    ...overrides,
  };
}

test('finding fingerprint is deterministic and semantically stable', () => {
  const engine = new FindingFingerprintEngine();
  const left = engine.fingerprint({
    metric: 'security_boundary',
    analyzerId: 'OhderSecurityBoundaryAnalyzerEngine',
    lawId: 'ohder-security-boundary',
    scope: 'auth-boundary',
    evidence: [
      { filePath: 'src/auth/SessionPolicy.js', reason: 'auth bypass signal detected' },
    ],
  });
  const right = engine.fingerprint({
    metric: 'security_boundary',
    analyzerId: 'OhderSecurityBoundaryAnalyzerEngine',
    lawId: 'ohder-security-boundary',
    scope: 'auth-boundary',
    evidence: [
      { filePath: 'src/auth/RenamedSessionPolicy.js', reason: 'auth bypass signal detected' },
    ],
  });
  const other = engine.fingerprint({
    metric: 'layer_isolation',
    analyzerId: 'OhderCouplingAnalyzerEngine',
    lawId: 'ohder-layer-isolation',
    scope: 'core-boundary',
    evidence: [
      { filePath: 'src/core/CoreRuntime.js', reason: 'core imports cli' },
    ],
  });

  assert.match(left, /^ohder-finding-[a-f0-9]{12}$/u);
  assert.equal(left, right);
  assert.notEqual(left, other);
});

test('finding resolution runtime writes findings, evidence packs, and detection events without suppressing blocking', async () => {
  const repoDir = setupRepo();
  const runtime = new FindingResolutionRuntime(repoDir);
  const result = await runtime.detectFromArchitect({
    sessionId: 'sess-ofrr',
    taskId: 'slice-ofrr',
    architect: {
      blocking: true,
      semanticFacts: [semanticFact()],
      lawViolations: [
        {
          id: 'ohder-security-boundary',
          metric: 'security_boundary',
          severity: 'critical',
          outcome: 'block',
          lawClass: 'hard',
          message: 'security boundary invalid',
        },
      ],
    },
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].blocking, true);
  assert.equal(result.findings[0].status, 'open');

  const paths = new AskPaths(repoDir);
  const store = new FileStore();
  const projection = await store.readJson(paths.ohderFindings(), {});
  assert.equal(Object.keys(projection.findings).length, 1);
  const projected = projection.findings[result.findings[0].id];
  assert.equal(projected.metric, 'security_boundary');
  assert.equal(projected.resolution, null);

  const evidence = await store.readJson(paths.ohderFindingEvidence(result.findings[0].id), {});
  assert.equal(evidence.findingId, result.findings[0].id);
  assert.equal(evidence.evidence.semanticFact.metric, 'security_boundary');

  const eventTypes = readEvents(repoDir).map(event => event.type);
  assert.ok(eventTypes.includes('OhderFindingDetected'));
  assert.ok(eventTypes.includes('OhderFindingFingerprintAssigned'));
  assert.ok(eventTypes.includes('OhderFindingEvidenceAttached'));
});

test('finding projector rebuilds finding state from ledger events', async () => {
  const repoDir = setupRepo();
  const ledger = new EventLedger(repoDir);
  await ledger.append({
    type: 'OhderFindingDetected',
    sessionId: 'sess-project',
    taskId: 'slice-project',
    actor: 'local',
    payload: {
      finding: {
        id: 'ohder-finding-abc123abc123',
        status: 'open',
        severity: 'critical',
        confidence: 'high',
        metric: 'security_boundary',
        analyzerId: 'OhderSecurityBoundaryAnalyzerEngine',
        lawId: 'ohder-security-boundary',
        scope: 'auth-boundary',
        blocking: true,
        evidenceRef: '.ask/runtime/findings/evidence/ohder-finding-abc123abc123.json',
        resolution: null,
        history: [],
      },
    },
    meta: { source: 'test' },
  });
  await ledger.append({
    type: 'OhderFindingResolved',
    sessionId: 'sess-project',
    taskId: 'slice-project',
    actor: 'local',
    payload: {
      findingId: 'ohder-finding-abc123abc123',
      decision: 'false-positive',
      reason: 'Security token string appears only in a fixture',
      approvedBy: 'architect',
      status: 'suppressed',
    },
    meta: { source: 'test' },
  });

  const projection = await new RuntimeProjectionEngine(repoDir).replay();
  assert.equal(projection.mode, 'full-replay');

  const paths = new AskPaths(repoDir);
  const store = new FileStore();
  const findings = await store.readJson(paths.ohderFindings(), {});
  assert.equal(findings.findings['ohder-finding-abc123abc123'].status, 'suppressed');
  assert.equal(findings.findings['ohder-finding-abc123abc123'].resolution.decision, 'false-positive');
});

test('architect runtime includes OFRR findings without changing OHDER blocking', async () => {
  const repoDir = setupRepo();
  const sourcePath = path.join(repoDir, 'ask-core', 'src', 'security', 'TokenPolicy.js');
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, 'export function skipAuth() { return true; }\n', 'utf8');

  const status = await new ArchitectRuntime(repoDir).assess({
    state: {
      sessionId: 'sess-architect',
      continuityValid: true,
      checkpointFresh: true,
    },
    slice: {
      id: 'slice-architect',
      execution: {
        operation: 'security-change',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      touchedFiles: ['ask-core/src/security/TokenPolicy.js'],
      operation: 'security-change',
    },
    validation: {
      status: 'passed',
      testsRun: ['npm test'],
    },
    policy: {
      ohder: { mode: 'strict' },
      architect: {
        enabled: true,
        max_entropy_delta: 10,
        max_coupling_delta: 10,
        require_replayability: false,
        block_on_violation: true,
      },
    },
  });

  assert.equal(status.blocking, true);
  assert.equal(Array.isArray(status.findings), true);
  assert.ok(status.findings.some(finding => finding.metric === 'security_boundary'));

  const falsePositive = status.findings.find(finding => finding.metric === 'security_boundary');
  const resolved = await new FindingResolutionRuntime(repoDir).resolve(falsePositive.id, {
    decision: 'false-positive',
    reason: 'Security token wording appears in a controlled compatibility fixture',
    approvedBy: 'architect',
  });
  assert.equal(resolved.ok, true);

  const stillBlocking = await new ArchitectRuntime(repoDir).readStatus();
  assert.equal(stillBlocking.blocking, true);
});

test('architect finding CLI lists, explains, and resolves findings', async () => {
  const repoDir = setupRepo();
  const runtime = new FindingResolutionRuntime(repoDir);
  const detected = await runtime.detectFromArchitect({
    sessionId: 'sess-cli',
    taskId: 'slice-cli',
    architect: {
      blocking: true,
      semanticFacts: [semanticFact()],
      lawViolations: [
        {
          id: 'ohder-security-boundary',
          metric: 'security_boundary',
          severity: 'critical',
          outcome: 'block',
          lawClass: 'hard',
        },
      ],
    },
  });
  const findingId = detected.findings[0].id;

  const list = runOrThrow(process.execPath, [askBinPath, 'architect', 'finding', 'list'], { cwd: repoDir });
  const listPayload = JSON.parse(list.stdout);
  assert.equal(listPayload.ok, true);
  assert.ok(listPayload.findings.some(finding => finding.id === findingId));

  const explain = runOrThrow(process.execPath, [askBinPath, 'architect', 'finding', 'explain', findingId], { cwd: repoDir });
  const explainPayload = JSON.parse(explain.stdout);
  assert.equal(explainPayload.ok, true);
  assert.equal(explainPayload.finding.id, findingId);
  assert.equal(explainPayload.evidence.findingId, findingId);
  const reviewedEvents = readEvents(repoDir).map(event => event.type);
  assert.ok(reviewedEvents.includes('OhderFindingReviewed'));
  assert.ok(reviewedEvents.includes('OhderFindingExplained'));

  const resolve = runOrThrow(process.execPath, [
    askBinPath,
    'architect',
    'finding',
    'resolve',
    findingId,
    '--decision',
    'false-positive',
    '--reason',
    'Security token string appears only in a deterministic fixture',
    '--approved-by',
    'architect',
  ], { cwd: repoDir });
  const resolvePayload = JSON.parse(resolve.stdout);
  assert.equal(resolvePayload.ok, true);
  assert.equal(resolvePayload.finding.status, 'suppressed');
});

test('governance explain and ask next surface unresolved findings', async () => {
  const repoDir = setupRepo();
  await new FindingResolutionRuntime(repoDir).detectFromArchitect({
    sessionId: 'sess-next',
    taskId: 'slice-next',
    architect: {
      blocking: true,
      semanticFacts: [semanticFact()],
      lawViolations: [
        {
          id: 'ohder-security-boundary',
          metric: 'security_boundary',
          severity: 'critical',
          outcome: 'block',
          lawClass: 'hard',
        },
      ],
    },
  });

  const explain = runOrThrow(process.execPath, [askBinPath, 'governance', 'explain'], { cwd: repoDir });
  const explainPayload = JSON.parse(explain.stdout);
  assert.equal(explainPayload.ok, true);
  assert.equal(explainPayload.explanation.unresolvedBlockingFindings.length, 1);

  const next = runOrThrow(process.execPath, [askBinPath, 'next'], { cwd: repoDir });
  const nextPayload = JSON.parse(next.stdout);
  assert.equal(nextPayload.next.type, 'ohder-action');
  assert.equal(nextPayload.next.action, 'inspect-ohder-findings');
  assert.equal(nextPayload.next.recommendedCommand, 'ask architect finding list');
});
