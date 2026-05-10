import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PolicyEngine } from './PolicyEngine.js';
import { RuntimeStateEngine } from './RuntimeStateEngine.js';
import { ArchitectRuntime } from './ArchitectRuntime.js';
import { GovernanceDecisionWriter } from './GovernanceDecisionWriter.js';
import { OhderEntropySnapshotEngine } from './OhderEntropySnapshotEngine.js';
import { MetricsWriter } from './MetricsWriter.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';

const execFileAsync = promisify(execFile);

function normalize(value) {
  return String(value ?? '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseGitStatusPath(line) {
  const raw = String(line ?? '').trimEnd();
  if (!raw) {
    return '';
  }
  const pathStart = raw.length > 2 && raw[2] === ' ' ? 3 : 2;
  return raw.slice(pathStart).trim();
}

function decisionFor(architect = {}) {
  if (architect.blocking === true) {
    return {
      decision: 'block',
      reason: normalize(architect.reason) || 'governance validation found blocking architecture risk',
      blocking: true,
    };
  }
  if (normalize(architect.status).toLowerCase() === 'failed') {
    return {
      decision: 'retry',
      reason: normalize(architect.reason) || 'governance validation found retryable architecture risk',
      blocking: false,
    };
  }
  return {
    decision: 'continue',
    reason: 'governance validation clear',
    blocking: false,
  };
}

export class GovernanceValidationRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.policyEngine = new PolicyEngine(cwd);
    this.stateEngine = new RuntimeStateEngine(cwd);
    this.architectRuntime = new ArchitectRuntime(cwd);
    this.decisionWriter = new GovernanceDecisionWriter(cwd);
    this.entropySnapshotEngine = new OhderEntropySnapshotEngine();
    this.metricsWriter = new MetricsWriter(cwd);
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async changedFiles() {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: this.cwd });
      return String(stdout ?? '')
        .split(/\r?\n/u)
        .map(line => line.trimEnd())
        .filter(Boolean)
        .map(parseGitStatusPath)
        .map(filePath => filePath.split(' -> ').at(-1))
        .map(filePath => normalize(filePath).replace(/\\/gu, '/'))
        .filter(Boolean)
        .filter(filePath => !filePath.startsWith('.ask/'));
    } catch {
      return [];
    }
  }

  async writeEntropy(architect, policy) {
    const history = await this.metricsWriter.readHistory();
    const previous = history.at(-1);
    const entropy = this.entropySnapshotEngine.snapshot({
      architect,
      previousArchitect: previous
        ? {
          architectureScore: {
            overallScore: toNumber(previous.architectureScore, 0),
          },
        }
        : null,
      driftAnalytics: await this.metricsWriter.readDriftAnalytics(),
      policy,
    });
    const metrics = await this.metricsWriter.read();
    await this.metricsWriter.write({
      ...metrics,
      latestEntropy: entropy,
      updatedAt: nowIso(),
    });
    return entropy;
  }

  async run() {
    const policy = await this.policyEngine.load();
    const state = await this.stateEngine.hydrate(policy);
    const touchedFiles = await this.changedFiles();
    const architect = await this.architectRuntime.assess({
      state,
      slice: {
        id: normalize(state.currentTaskId) || 'governance-validation',
        execution: {
          operation: 'governance-validation',
        },
      },
      execution: {
        ...(state.latestExecution || {}),
        ok: true,
        status: 'completed',
        exitCode: 0,
        touchedFiles,
        operation: 'governance-validation',
      },
      validation: {
        ...(state.latestValidation || {}),
        status: 'passed',
        testsRun: ['governance-validation'],
      },
      policy,
    });
    const entropy = await this.writeEntropy(architect, policy);
    const outcome = decisionFor(architect);
    const decision = await this.decisionWriter.write({
      loopId: normalize(state.loop?.loopId),
      sessionId: normalize(state.sessionId),
      sliceId: normalize(state.currentTaskId) || 'governance-validation',
      intentType: 'governance-validation',
      decision: outcome.decision,
      reason: outcome.reason,
      recoveryStatus: outcome.decision === 'continue' ? 'clear' : 'requires-action',
      validationStatus: 'passed',
      architectStatus: normalize(architect.status),
      flowStatus: normalize(state.flow?.status),
      blocking: outcome.blocking,
    });

    await this.ledger.append({
      type: 'GovernanceValidationCompleted',
      sessionId: normalize(state.sessionId),
      taskId: normalize(state.currentTaskId),
      actor: 'local',
      payload: {
        architectStatus: normalize(architect.status),
        blocking: architect.blocking === true,
        entropy,
        touchedFiles,
      },
      meta: {
        source: 'governance-validation-runtime',
        schemaVersion: 1,
      },
    });
    await this.ledger.append({
      type: 'GovernanceDecisionWritten',
      sessionId: normalize(state.sessionId),
      taskId: normalize(state.currentTaskId),
      actor: 'local',
      payload: {
        governanceDecision: decision,
      },
      meta: {
        source: 'governance-validation-runtime',
        schemaVersion: 1,
      },
    });
    await this.projectionEngine.projectIncremental();

    return {
      ok: true,
      decision,
      architect,
      entropy,
      touchedFiles,
    };
  }
}
