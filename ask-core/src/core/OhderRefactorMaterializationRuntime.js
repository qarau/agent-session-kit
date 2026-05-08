import { ArchitectRuntime } from './ArchitectRuntime.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { MetricsWriter } from './MetricsWriter.js';
import { OhderEntropySnapshotEngine } from './OhderEntropySnapshotEngine.js';
import { OhderRefactorRecommendationEngine } from './OhderRefactorRecommendationEngine.js';
import { PolicyEngine } from './PolicyEngine.js';
import { RefactorGovernanceEngine } from './RefactorGovernanceEngine.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { RuntimeStateEngine } from './RuntimeStateEngine.js';
import { TaskRuntime } from './TaskRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function taskIdForRecommendation(recommendation) {
  return `ohder-refactor-${normalize(recommendation?.fingerprint).slice(0, 12)}`;
}

function descriptionFor(recommendation) {
  return [
    normalize(recommendation.objective),
    normalize(recommendation.reason),
    `Target signals: ${Array.isArray(recommendation.targetSignals) ? recommendation.targetSignals.join(', ') : ''}`,
  ].filter(Boolean).join('\n\n');
}

export class OhderRefactorMaterializationRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.policyEngine = new PolicyEngine(cwd);
    this.stateEngine = new RuntimeStateEngine(cwd);
    this.architectRuntime = new ArchitectRuntime(cwd);
    this.metricsWriter = new MetricsWriter(cwd);
    this.entropySnapshotEngine = new OhderEntropySnapshotEngine();
    this.recommendationEngine = new OhderRefactorRecommendationEngine();
    this.refactorGovernanceEngine = new RefactorGovernanceEngine();
    this.taskRuntime = new TaskRuntime(cwd);
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async buildContext() {
    const policy = await this.policyEngine.load();
    const state = await this.stateEngine.hydrate(policy);
    const architect = await this.architectRuntime.readStatus();
    const history = await this.metricsWriter.readHistory();
    const previousHistoryEntry = history.at(-1);
    const previousArchitect = previousHistoryEntry
      ? {
        architectureScore: {
          overallScore: toNumber(previousHistoryEntry.architectureScore, 0),
        },
      }
      : null;
    const driftAnalytics = await this.metricsWriter.readDriftAnalytics();
    const entropy = this.entropySnapshotEngine.snapshot({
      architect,
      previousArchitect,
      driftAnalytics,
      policy,
    });
    const refactorGovernance = this.refactorGovernanceEngine.evaluate({
      architect,
      policy,
      slice: {
        title: 'OHDER refactor materialization',
      },
    });
    return {
      policy,
      state,
      architect,
      entropy,
      refactorGovernance,
    };
  }

  async recommendationFromCurrentState() {
    const context = await this.buildContext();
    const recommendation = this.recommendationEngine.recommend(context);
    return {
      ...context,
      recommendation,
    };
  }

  async preview() {
    const { recommendation, architect, entropy, refactorGovernance } = await this.recommendationFromCurrentState();
    return {
      ok: true,
      mode: 'preview',
      recommendation,
      architect,
      entropy,
      refactorGovernance,
    };
  }

  resolveConfidenceDecision(recommendation, policy, auto = false) {
    const confidence = normalize(recommendation?.confidence).toLowerCase();
    const settings = policy?.refactor_materialization ?? {};
    if (confidence === 'low') {
      return { create: false, decision: 'suggest-only', approvalRequired: false };
    }
    if (auto && confidence === 'high' && settings.auto_materialize_high_confidence !== true) {
      return { create: false, decision: 'auto-disabled', approvalRequired: false };
    }
    if (confidence === 'medium' && settings.require_approval_for_medium_confidence !== false) {
      return { create: true, decision: 'approval-required', approvalRequired: true };
    }
    return { create: true, decision: 'create', approvalRequired: false };
  }

  async create({ requestedBy = 'local', auto = false } = {}) {
    const { recommendation, state, architect, entropy, refactorGovernance, policy } = await this.recommendationFromCurrentState();
    if (!recommendation) {
      return {
        ok: true,
        mode: 'create',
        created: false,
        recommendation: null,
        task: null,
        architect,
        entropy,
        refactorGovernance,
      };
    }

    const decision = this.resolveConfidenceDecision(recommendation, policy, auto);
    if (!decision.create) {
      return {
        ok: true,
        mode: 'create',
        created: false,
        decision: decision.decision,
        recommendation,
        task: null,
        architect,
        entropy,
        refactorGovernance,
      };
    }

    const taskId = taskIdForRecommendation(recommendation);
    const existing = await this.taskRuntime.getTask(taskId);
    if (existing) {
      return {
        ok: true,
        mode: 'create',
        created: false,
        decision: 'existing',
        recommendation,
        task: existing,
        architect,
        entropy,
        refactorGovernance,
      };
    }

    const context = await this.taskRuntime.getActiveSessionContext();
    const created = await this.taskRuntime.appendTaskEvent(
      'TaskCreated',
      taskId,
      {
        title: normalize(recommendation.title),
        description: descriptionFor(recommendation),
        acceptanceCriteria: Array.isArray(recommendation.acceptanceCriteria)
          ? [...recommendation.acceptanceCriteria]
          : [],
        queueClassHint: 'integrator',
        origin: {
          type: 'ohder-refactor-governance',
          recommendationFingerprint: normalize(recommendation.fingerprint),
          confidence: normalize(recommendation.confidence),
          targetSignals: Array.isArray(recommendation.targetSignals) ? [...recommendation.targetSignals] : [],
          requestedBy: normalize(requestedBy),
          approvalRequired: decision.approvalRequired,
        },
      },
      { source: 'ohder-refactor-materialization-runtime' }
    );

    const suggested = await this.ledger.append({
      type: 'RefactorSuggested',
      sessionId: normalize(state.sessionId) || context.sessionId,
      taskId,
      actor: normalize(requestedBy) || context.actor,
      payload: {
        taskId,
        recommendationFingerprint: normalize(recommendation.fingerprint),
        recommendation,
        entropy,
        architectStatus: normalize(architect.status),
        architectureScore: toNumber(architect?.architectureScore?.overallScore, 0),
      },
      meta: {
        source: 'ohder-refactor-materialization-runtime',
        schemaVersion: 1,
      },
    });
    await this.projectionEngine.projectIncremental();

    return {
      ok: true,
      mode: 'create',
      created: true,
      decision: decision.decision,
      recommendation,
      task: created,
      events: [suggested],
      architect,
      entropy,
      refactorGovernance,
    };
  }
  async approve(taskId, { approvedBy = 'local' } = {}) {
    const resolvedTaskId = normalize(taskId);
    const task = await this.taskRuntime.getTask(resolvedTaskId);
    if (!task) {
      return { ok: false, code: 'task-not-found', message: `task not found: ${resolvedTaskId}`, taskId: resolvedTaskId };
    }
    if (normalize(task?.refactorGovernance?.approvalStatus) === 'approved') {
      return { ok: true, task, event: null, idempotent: true };
    }
    const context = await this.taskRuntime.getActiveSessionContext();
    const event = await this.ledger.append({
      type: 'RefactorApproved',
      sessionId: context.sessionId,
      taskId: resolvedTaskId,
      actor: normalize(approvedBy) || context.actor,
      payload: {
        taskId: resolvedTaskId,
        approvedBy: normalize(approvedBy) || context.actor,
        recommendationFingerprint: normalize(task?.origin?.recommendationFingerprint || task?.refactorGovernance?.recommendationFingerprint),
      },
      meta: {
        source: 'ohder-refactor-materialization-runtime',
        schemaVersion: 1,
      },
    });
    await this.projectionEngine.projectIncremental();
    const updated = await this.taskRuntime.getTask(resolvedTaskId);
    return { ok: true, task: updated, event, idempotent: false };
  }

  async reject(taskId, { reason = '', rejectedBy = 'local' } = {}) {
    const resolvedTaskId = normalize(taskId);
    const task = await this.taskRuntime.getTask(resolvedTaskId);
    if (!task) {
      return { ok: false, code: 'task-not-found', message: `task not found: ${resolvedTaskId}`, taskId: resolvedTaskId };
    }
    if (normalize(task?.refactorGovernance?.approvalStatus) === 'rejected') {
      return { ok: true, task, event: null, idempotent: true };
    }
    const context = await this.taskRuntime.getActiveSessionContext();
    const event = await this.ledger.append({
      type: 'RefactorRejected',
      sessionId: context.sessionId,
      taskId: resolvedTaskId,
      actor: normalize(rejectedBy) || context.actor,
      payload: {
        taskId: resolvedTaskId,
        reason: normalize(reason),
        rejectedBy: normalize(rejectedBy) || context.actor,
        recommendationFingerprint: normalize(task?.origin?.recommendationFingerprint || task?.refactorGovernance?.recommendationFingerprint),
      },
      meta: {
        source: 'ohder-refactor-materialization-runtime',
        schemaVersion: 1,
      },
    });
    await this.projectionEngine.projectIncremental();
    const updated = await this.taskRuntime.getTask(resolvedTaskId);
    return { ok: true, task: updated, event, idempotent: false };
  }
}
