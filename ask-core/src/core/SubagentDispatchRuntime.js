import path from 'node:path';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { AgentRuntime } from './AgentRuntime.js';
import { ChildSessionRuntime } from './ChildSessionRuntime.js';
import { ClaimRuntime } from './ClaimRuntime.js';
import { RoutingRuntime } from './RoutingRuntime.js';
import { TaskRuntime } from './TaskRuntime.js';
import { VerificationRuntime } from './VerificationRuntime.js';
import { ExecutionProviderRegistry } from './providers/ExecutionProviderRegistry.js';
import { ExecutionPolicyRuntime } from './ExecutionPolicyRuntime.js';
import { RoutingPolicyEngine } from '../policy/RoutingPolicyEngine.js';
import { DispatchRedactionPolicy, resolveRedactionLevel } from './DispatchRedactionPolicy.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function list(value) {
  if (Array.isArray(value)) {
    return value.map(entry => normalize(entry)).filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function nowIso(nowMs) {
  return new Date(nowMs()).toISOString();
}

function defaultChildSessionId(taskId, nowMs) {
  return `${normalize(taskId)}_child_${nowMs().toString(36)}`;
}

function deriveVerificationOutcome(dispatchResult, requestedOutcome = '') {
  const requested = normalize(requestedOutcome).toLowerCase();
  if (requested === 'pass' || requested === 'fail') {
    return requested;
  }
  return dispatchResult?.ok ? 'pass' : 'fail';
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalize(value).toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function toCapabilitySet(capabilities = []) {
  const set = new Set();
  for (const capability of list(capabilities)) {
    const normalized = capability.toLowerCase();
    if (normalized) {
      set.add(normalized);
    }
  }
  return set;
}

function toLowerSet(values = []) {
  const set = new Set();
  for (const value of list(values)) {
    set.add(value.toLowerCase());
  }
  return set;
}

function ensureReasonText(value) {
  const reason = normalize(value);
  return reason.length >= 10 ? reason : '';
}

function allPromotionGatesPassed(promotion = null) {
  const gates = promotion?.gates ?? {};
  const gateIds = Object.keys(gates);
  if (gateIds.length < 1) {
    return false;
  }
  return gateIds.every(gateId => normalize(gates[gateId]?.status).toLowerCase() === 'passed');
}

const RETRYABLE_STATUSES = new Set(['timeout']);
const RELEASE_CRITICAL_QUEUE_CLASSES = new Set(['integrator', 'reviewer']);
const APPROVAL_REQUIRED_OVERRIDES = new Set(['policy', 'promotion']);
const DISPATCH_POLICY_HOOKS = Object.freeze({
  planner: { timeoutMs: 45_000, maxRetries: 0 },
  implementer: { timeoutMs: 120_000, maxRetries: 1 },
  verifier: { timeoutMs: 90_000, maxRetries: 1 },
  debugger: { timeoutMs: 180_000, maxRetries: 2 },
  integrator: { timeoutMs: 120_000, maxRetries: 1 },
  reviewer: { timeoutMs: 60_000, maxRetries: 0 },
});

function resolveDispatchPolicyHooks(queueClass, options = {}) {
  const key = normalize(queueClass).toLowerCase() || 'reviewer';
  const base = DISPATCH_POLICY_HOOKS[key] ?? DISPATCH_POLICY_HOOKS.reviewer;
  return {
    queueClass: key,
    timeoutMs: toPositiveNumber(options.timeoutMs, base.timeoutMs),
    maxRetries: Math.max(0, Math.floor(toNumber(options.maxRetries, base.maxRetries))),
    defaultTimeoutMs: base.timeoutMs,
    defaultMaxRetries: base.maxRetries,
  };
}

export class SubagentDispatchRuntime {
  constructor(cwd, overrides = {}) {
    this.cwd = cwd;
    this.nowMs = overrides.nowMs ?? (() => Date.now());
    this.paths = new AskPaths(cwd);
    this.store = overrides.store ?? new FileStore();
    this.ledger = overrides.ledger ?? new EventLedger(cwd);
    this.projectionEngine = overrides.projectionEngine ?? new RuntimeProjectionEngine(cwd);

    this.taskRuntime = overrides.taskRuntime ?? new TaskRuntime(cwd);
    this.agentRuntime = overrides.agentRuntime ?? new AgentRuntime(cwd);
    this.routingRuntime = overrides.routingRuntime ?? new RoutingRuntime(cwd);
    this.claimRuntime = overrides.claimRuntime ?? new ClaimRuntime(cwd);
    this.childSessionRuntime = overrides.childSessionRuntime ?? new ChildSessionRuntime(cwd);
    this.verificationRuntime = overrides.verificationRuntime ?? new VerificationRuntime(cwd);
    this.executionPolicyRuntime = overrides.executionPolicyRuntime ?? new ExecutionPolicyRuntime(cwd);
    this.providerRegistry = overrides.providerRegistry ?? new ExecutionProviderRegistry(overrides.providerRegistryOverrides ?? {});
    this.routingPolicyEngine = overrides.routingPolicyEngine ?? new RoutingPolicyEngine();
  }

  async getSessionContext() {
    const session = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    return {
      sessionId: normalize(session.sessionId),
      actor: normalize(session.actorId) || 'local',
    };
  }

  async appendEvent(type, taskId, payload = {}, meta = {}) {
    const context = await this.getSessionContext();
    await this.ledger.append({
      type,
      sessionId: context.sessionId,
      taskId: normalize(taskId),
      actor: context.actor,
      payload,
      meta,
    });
    await this.projectionEngine.projectIncremental();
  }

  async readDispatchSnapshot(taskId = '') {
    const snapshot = await this.store.readJson(this.paths.subagentDispatchSnapshot(), { tasks: {} });
    const resolvedTaskId = normalize(taskId);
    if (!resolvedTaskId) {
      return { ok: true, tasks: snapshot.tasks ?? {} };
    }
    const task = snapshot.tasks?.[resolvedTaskId];
    if (!task) {
      return fail('dispatch-not-found', `dispatch not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }
    return { ok: true, dispatch: task };
  }

  async readDispatchControlSnapshot() {
    return this.store.readJson(this.paths.subagentDispatchControlSnapshot(), { tasks: {} });
  }

  async writeDispatchControlTask(taskId, patch = {}) {
    const resolvedTaskId = normalize(taskId);
    const current = await this.readDispatchControlSnapshot();
    const previous = current.tasks?.[resolvedTaskId] ?? {};
    const nextRecord = {
      ...previous,
      ...patch,
      taskId: resolvedTaskId,
      updatedAt: nowIso(this.nowMs),
    };
    const tasks = {
      ...(current.tasks ?? {}),
      [resolvedTaskId]: nextRecord,
    };
    await this.store.writeJson(this.paths.subagentDispatchControlSnapshot(), { tasks });
    return nextRecord;
  }

  async readClaimsSnapshot() {
    return this.store.readJson(this.paths.claimsSnapshot(), { tasks: {} });
  }

  async readVerificationSnapshot() {
    return this.store.readJson(this.paths.verificationSnapshot(), { tasks: {} });
  }

  async readFreshnessSnapshot() {
    return this.store.readJson(this.paths.freshnessSnapshot(), { tasks: {} });
  }

  async readFeaturesSnapshot() {
    return this.store.readJson(this.paths.featuresSnapshot(), { features: {} });
  }

  async readReleaseTrainsSnapshot() {
    return this.store.readJson(this.paths.releaseTrainsSnapshot(), { trains: {} });
  }

  async readPromotionGatesSnapshot() {
    return this.store.readJson(this.paths.promotionGatesSnapshot(), { features: {} });
  }

  resolveArtifactPath(taskId, options = {}) {
    const explicitPath = normalize(options.artifactPath);
    if (explicitPath) {
      return path.isAbsolute(explicitPath) ? explicitPath : path.resolve(this.cwd, explicitPath);
    }
    const artifactDir = normalize(options.artifactDir) || '.ask/evidence/dispatch';
    const timestamp = this.nowMs();
    return path.resolve(this.cwd, artifactDir, `${normalize(taskId)}-${timestamp}.json`);
  }

  async ensureTask(taskId, options = {}) {
    const taskStatus = await this.taskRuntime.status(taskId);
    if (!taskStatus.ok && taskStatus.code === 'task-not-found') {
      const title = normalize(options.title);
      if (!title) {
        return fail('task-not-found', `task not found: ${normalize(taskId)}; provide --title to create`, {
          taskId: normalize(taskId),
        });
      }
      const created = await this.taskRuntime.create(taskId, title, normalize(options.description));
      if (!created.ok) {
        return created;
      }
    } else if (!taskStatus.ok) {
      return taskStatus;
    }

    let refreshed = await this.taskRuntime.status(taskId);
    if (!refreshed.ok) {
      return refreshed;
    }

    const current = refreshed.task ?? {};
    const currentStatus = normalize(current.status);
    const currentOwner = normalize(current.owner);
    const nextOwner = normalize(options.owner) || 'codex-main';
    if ((currentStatus === 'created' || currentStatus === 'in-progress') && currentOwner !== nextOwner) {
      const assigned = await this.taskRuntime.assign(taskId, nextOwner);
      if (!assigned.ok) {
        return assigned;
      }
      refreshed = await this.taskRuntime.status(taskId);
      if (!refreshed.ok) {
        return refreshed;
      }
    }

    if (normalize(refreshed.task?.status) === 'created') {
      const started = await this.taskRuntime.start(taskId);
      if (!started.ok) {
        return started;
      }
      refreshed = await this.taskRuntime.status(taskId);
      if (!refreshed.ok) {
        return refreshed;
      }
    }

    return { ok: true, task: refreshed.task };
  }

  async resolveAgent(taskId, options = {}) {
    const explicitAgentId = normalize(options.agentId);
    if (explicitAgentId) {
      const status = await this.agentRuntime.status(explicitAgentId);
      if (!status.ok && status.code === 'agent-not-found') {
        const capabilities = list(options.capabilities);
        if (capabilities.length < 1) {
          return fail('agent-not-found', `agent not found: ${explicitAgentId}; provide --capabilities to register`, {
            agentId: explicitAgentId,
          });
        }
        const registered = await this.agentRuntime.register(explicitAgentId, capabilities);
        if (!registered.ok) {
          return registered;
        }
      } else if (!status.ok) {
        return status;
      }
      const refreshed = await this.agentRuntime.status(explicitAgentId);
      if (!refreshed.ok) {
        return refreshed;
      }
      return { ok: true, agentId: explicitAgentId, route: null, agent: refreshed.agent ?? null };
    }

    const recommendation = await this.routingRuntime.recommend(taskId, normalize(options.candidates));
    if (!recommendation.ok) {
      return recommendation;
    }
    const routedAgentId = normalize(recommendation.recommendation?.agentId);
    if (!routedAgentId) {
      return fail('route-missing-agent', 'routing recommendation missing agent id', {
        taskId: normalize(taskId),
      });
    }
    const routedAgent = await this.agentRuntime.status(routedAgentId);
    if (!routedAgent.ok) {
      return routedAgent;
    }
    return {
      ok: true,
      agentId: routedAgentId,
      route: recommendation.recommendation,
      agent: routedAgent.agent ?? null,
    };
  }

  validateOverrideGovernance(policyDecision, overrideType, reason, options = {}) {
    const typeKey = normalize(overrideType).toLowerCase();
    const allowedOverrides = toLowerSet(policyDecision?.allowedOverrides);
    if (!allowedOverrides.has(typeKey)) {
      return fail('override-governance-invalid', 'override type is not allowed by policy pack', {
        overrideType: typeKey,
        allowedOverrides: Array.from(allowedOverrides).sort(),
        packId: normalize(policyDecision?.packId),
      });
    }

    const normalizedReason = ensureReasonText(reason);
    if (!normalizedReason) {
      return fail('override-governance-invalid', 'override reason must be at least 10 characters', {
        overrideType: typeKey,
        packId: normalize(policyDecision?.packId),
      });
    }

    const approvalRequired = Boolean(policyDecision?.overrideApprovalRequired) || APPROVAL_REQUIRED_OVERRIDES.has(typeKey);
    const approvedBy = normalize(options.overrideApprovedBy);
    if (approvalRequired && !approvedBy) {
      return fail('override-governance-invalid', 'override approval metadata is required by policy', {
        overrideType: typeKey,
        packId: normalize(policyDecision?.packId),
      });
    }

    return {
      ok: true,
      reason: normalizedReason,
      approvedBy,
      approvalRequired,
    };
  }

  enforceProviderAllowlist(policyDecision, providerName, taskId) {
    const provider = normalize(providerName).toLowerCase();
    const allowlist = toLowerSet(policyDecision?.providerAllowlist);
    if (allowlist.size < 1 || allowlist.has(provider)) {
      return {
        ok: true,
        allowlist: Array.from(allowlist).sort(),
      };
    }
    return fail('provider-not-allowed', 'provider is not allowlisted by policy pack', {
      taskId: normalize(taskId),
      provider,
      allowedProviders: Array.from(allowlist).sort(),
      packId: normalize(policyDecision?.packId),
    });
  }

  async resolveDispatchPolicy(taskId, options = {}) {
    const applied = await this.executionPolicyRuntime.apply(taskId, normalize(options.queueClass));
    if (!applied.ok) {
      return applied;
    }

    const action = normalize(applied.decision?.action).toLowerCase();
    if (action !== 'dispatch') {
      if (!toBoolean(options.allowPolicyHoldOverride)) {
        return fail('dispatch-held-by-policy', 'dispatch blocked by policy decision', {
          taskId: normalize(taskId),
          queueClass: normalize(applied.queueClass),
          action: normalize(applied.decision?.action),
          reason: normalize(applied.decision?.reason),
        });
      }

      const governance = this.validateOverrideGovernance(
        applied.decision,
        'policy',
        options.policyOverrideReason,
        options
      );
      if (!governance.ok) {
        return governance;
      }

      await this.appendEvent(
        'SubagentPolicyOverrideLogged',
        taskId,
        {
          queueClass: normalize(applied.queueClass),
          action: normalize(applied.decision?.action),
          reason: normalize(applied.decision?.reason),
          overrideReason: governance.reason,
          approvedBy: governance.approvedBy,
        },
        { source: 'subagent-dispatch-runtime' }
      );
    }

    return {
      ok: true,
      queueClass: normalize(applied.queueClass),
      decision: applied.decision ?? {},
    };
  }

  async determineRequiredCapability(taskId, resolvedAgent, options = {}) {
    const overrideCapability = normalize(options.requiredCapability).toLowerCase();
    if (overrideCapability) {
      return {
        ok: true,
        requiredCapability: overrideCapability,
        policy: 'manual-override',
        reason: 'required capability specified by dispatch caller',
      };
    }

    const routeCapability = normalize(resolvedAgent.route?.requiredCapability).toLowerCase();
    if (routeCapability) {
      return {
        ok: true,
        requiredCapability: routeCapability,
        policy: normalize(resolvedAgent.route?.policy),
        reason: normalize(resolvedAgent.route?.reason),
      };
    }

    const taskStatus = await this.taskRuntime.status(taskId);
    if (!taskStatus.ok) {
      return taskStatus;
    }

    const verification = (await this.readVerificationSnapshot()).tasks?.[taskId] ?? null;
    const freshness = (await this.readFreshnessSnapshot()).tasks?.[taskId] ?? null;
    const recommendation = this.routingPolicyEngine.recommend({
      task: taskStatus.task ?? {},
      verification,
      freshness,
    });

    return {
      ok: true,
      requiredCapability: normalize(recommendation.requiredCapability).toLowerCase(),
      policy: normalize(recommendation.policy),
      reason: normalize(recommendation.reason),
    };
  }

  async enforceCapabilityMatch(taskId, resolvedAgent, policyDecision, options = {}) {
    const requirement = await this.determineRequiredCapability(taskId, resolvedAgent, options);
    if (!requirement.ok) {
      return requirement;
    }

    const requiredCapability = normalize(requirement.requiredCapability).toLowerCase();
    const agentCapabilities = list(resolvedAgent.agent?.capabilities);

    if (!requiredCapability) {
      return {
        ok: true,
        requiredCapability: '',
        agentCapabilities,
        policy: normalize(requirement.policy),
        reason: normalize(requirement.reason),
        overridden: false,
      };
    }

    const hasRequiredCapability = toCapabilitySet(agentCapabilities).has(requiredCapability);
    if (hasRequiredCapability) {
      return {
        ok: true,
        requiredCapability,
        agentCapabilities,
        policy: normalize(requirement.policy),
        reason: normalize(requirement.reason),
        overridden: false,
      };
    }

    if (!toBoolean(options.allowCapabilityOverride)) {
      return fail('capability-mismatch', 'agent does not satisfy required capability', {
        taskId: normalize(taskId),
        agentId: normalize(resolvedAgent.agentId),
        requiredCapability,
        agentCapabilities,
        policy: normalize(requirement.policy),
        reason: normalize(requirement.reason),
      });
    }

    const governance = this.validateOverrideGovernance(
      policyDecision,
      'capability',
      options.capabilityOverrideReason,
      options
    );
    if (!governance.ok) {
      return governance;
    }

    await this.appendEvent(
      'SubagentCapabilityOverrideLogged',
      taskId,
      {
        agentId: normalize(resolvedAgent.agentId),
        requiredCapability,
        agentCapabilities,
        policy: normalize(requirement.policy),
        reason: normalize(requirement.reason),
        overrideReason: governance.reason,
        approvedBy: governance.approvedBy,
      },
      { source: 'subagent-dispatch-runtime' }
    );

    return {
      ok: true,
      requiredCapability,
      agentCapabilities,
      policy: normalize(requirement.policy),
      reason: normalize(requirement.reason),
      overridden: true,
    };
  }

  async enforceClaimScope(taskId, agentId, scope, options = {}) {
    const claims = await this.readClaimsSnapshot();
    const existing = claims.tasks?.[taskId] ?? null;
    if (!existing) {
      return { ok: true, claim: null, overridden: false };
    }

    const status = normalize(existing.status).toLowerCase();
    if (status !== 'acquired' && status !== 'locked') {
      return { ok: true, claim: existing, overridden: false };
    }

    const existingAgentId = normalize(existing.lastAgentId || existing.lock?.agentId);
    const existingScope = normalize(existing.lastScope || existing.lock?.scope) || 'task';
    const scopeMatches = existingScope === scope;
    const agentMatches = existingAgentId === agentId;

    if (scopeMatches && agentMatches) {
      return { ok: true, claim: existing, overridden: false };
    }

    if (!toBoolean(options.allowClaimOverride)) {
      if (!scopeMatches) {
        return fail('claim-scope-mismatch', 'dispatch scope does not match active claim scope', {
          taskId: normalize(taskId),
          agentId,
          scope,
          existingAgentId,
          existingScope,
          status,
        });
      }
      return fail('claim-owned-by-other-agent', 'active claim is owned by another agent', {
        taskId: normalize(taskId),
        agentId,
        scope,
        existingAgentId,
        existingScope,
        status,
      });
    }

    const governance = this.validateOverrideGovernance(
      options.policyDecision,
      'claim',
      options.claimOverrideReason,
      options
    );
    if (!governance.ok) {
      return governance;
    }

    await this.appendEvent(
      'SubagentClaimOverrideLogged',
      taskId,
      {
        agentId,
        scope,
        previousClaim: {
          status,
          agentId: existingAgentId,
          scope: existingScope,
        },
        overrideReason: governance.reason,
        approvedBy: governance.approvedBy,
      },
      { source: 'subagent-dispatch-runtime' }
    );

    return { ok: true, claim: existing, overridden: true };
  }

  async resolveReleaseCriticalContext(taskId) {
    const features = (await this.readFeaturesSnapshot()).features ?? {};
    const trains = (await this.readReleaseTrainsSnapshot()).trains ?? {};

    const taskFeatures = Object.entries(features)
      .filter(([, feature]) => Array.isArray(feature?.tasks) && feature.tasks.includes(taskId))
      .map(([featureId]) => normalize(featureId))
      .filter(Boolean)
      .sort();

    if (taskFeatures.length < 1) {
      return {
        releaseCritical: false,
        taskFeatures: [],
        releaseFeatureIds: [],
        releaseTrainIds: [],
      };
    }

    const releaseFeatureIds = new Set();
    const releaseTrainIds = new Set();
    for (const [trainId, train] of Object.entries(trains)) {
      const trainFeatures = Array.isArray(train?.features) ? train.features : [];
      const intersection = taskFeatures.filter(featureId => trainFeatures.includes(featureId));
      if (intersection.length > 0) {
        releaseTrainIds.add(normalize(trainId));
        for (const featureId of intersection) {
          releaseFeatureIds.add(featureId);
        }
      }
    }

    return {
      releaseCritical: releaseFeatureIds.size > 0,
      taskFeatures,
      releaseFeatureIds: Array.from(releaseFeatureIds).sort(),
      releaseTrainIds: Array.from(releaseTrainIds).sort(),
    };
  }

  async enforcePromotionGates(taskId, queueClass, options = {}) {
    const context = await this.resolveReleaseCriticalContext(taskId);
    if (!context.releaseCritical) {
      return {
        ok: true,
        releaseCritical: false,
        checked: false,
        unmet: [],
        overridden: false,
      };
    }

    const queueKey = normalize(queueClass).toLowerCase();
    const shouldCheck = RELEASE_CRITICAL_QUEUE_CLASSES.has(queueKey) || toBoolean(options.requirePromotionGates);
    if (!shouldCheck) {
      return {
        ok: true,
        releaseCritical: true,
        checked: false,
        unmet: [],
        overridden: false,
      };
    }

    const promotions = (await this.readPromotionGatesSnapshot()).features ?? {};
    const unmet = [];

    for (const featureId of context.releaseFeatureIds) {
      const promotion = promotions[featureId] ?? null;
      if (allPromotionGatesPassed(promotion)) {
        continue;
      }

      const gateEntries = Object.entries(promotion?.gates ?? {});
      if (gateEntries.length < 1) {
        unmet.push({
          featureId,
          reason: 'no-required-gates',
          gateIds: [],
        });
        continue;
      }

      const gateIds = gateEntries
        .filter(([, gate]) => normalize(gate?.status).toLowerCase() !== 'passed')
        .map(([gateId]) => normalize(gateId))
        .filter(Boolean)
        .sort();
      if (gateIds.length > 0) {
        unmet.push({
          featureId,
          reason: 'gates-unmet',
          gateIds,
        });
      }
    }

    if (unmet.length < 1) {
      return {
        ok: true,
        releaseCritical: true,
        checked: true,
        unmet: [],
        overridden: false,
      };
    }

    if (!toBoolean(options.allowPromotionGateOverride)) {
      return fail('promotion-gates-unmet', 'release-critical task has unmet promotion gates', {
        taskId: normalize(taskId),
        queueClass: queueKey,
        releaseFeatureIds: context.releaseFeatureIds,
        releaseTrainIds: context.releaseTrainIds,
        unmetGates: unmet,
      });
    }

    const governance = this.validateOverrideGovernance(
      options.policyDecision,
      'promotion',
      options.promotionOverrideReason,
      options
    );
    if (!governance.ok) {
      return governance;
    }

    await this.appendEvent(
      'SubagentPromotionGateOverrideLogged',
      taskId,
      {
        queueClass: queueKey,
        releaseFeatureIds: context.releaseFeatureIds,
        releaseTrainIds: context.releaseTrainIds,
        unmetGates: unmet,
        overrideReason: governance.reason,
        approvedBy: governance.approvedBy,
      },
      { source: 'subagent-dispatch-runtime' }
    );

    return {
      ok: true,
      releaseCritical: true,
      checked: true,
      unmet,
      overridden: true,
    };
  }

  async dispatch(taskId, options = {}) {
    const resolvedTaskId = normalize(taskId);
    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }

    const task = await this.ensureTask(resolvedTaskId, options);
    if (!task.ok) {
      return task;
    }

    const resolvedAgent = await this.resolveAgent(resolvedTaskId, options);
    if (!resolvedAgent.ok) {
      return resolvedAgent;
    }

    const policyResult = await this.resolveDispatchPolicy(resolvedTaskId, options);
    if (!policyResult.ok) {
      return policyResult;
    }

    const controlSnapshot = await this.readDispatchControlSnapshot();
    const existingControl = controlSnapshot.tasks?.[resolvedTaskId] ?? null;

    const requestedChildSessionId = normalize(options.childSessionId);
    const resumeCandidateChildSessionId =
      requestedChildSessionId
      || normalize(existingControl?.childSessionId);
    const childSessionId = resumeCandidateChildSessionId || defaultChildSessionId(resolvedTaskId, this.nowMs);
    const idempotencyKey = `${resolvedTaskId}:${childSessionId}`;
    const resumeDispatchId = normalize(existingControl?.dispatchId);
    const canResumeDispatch =
      normalize(existingControl?.provider).toLowerCase() === normalize(options.provider || 'codex').toLowerCase()
      && normalize(existingControl?.status).toLowerCase() === 'started'
      && normalize(existingControl?.childSessionId) === childSessionId
      && Boolean(resumeDispatchId);

    const scope = normalize(options.scope) || 'task';
    const claimGuard = await this.enforceClaimScope(
      resolvedTaskId,
      normalize(resolvedAgent.agentId),
      scope,
      {
        ...options,
        policyDecision: policyResult.decision ?? {},
      }
    );
    if (!claimGuard.ok) {
      return claimGuard;
    }

    const capabilityGuard = await this.enforceCapabilityMatch(
      resolvedTaskId,
      resolvedAgent,
      policyResult.decision ?? {},
      options
    );
    if (!capabilityGuard.ok) {
      return capabilityGuard;
    }

    const promotionGuard = await this.enforcePromotionGates(resolvedTaskId, policyResult.queueClass, {
      ...options,
      policyDecision: policyResult.decision ?? {},
    });
    if (!promotionGuard.ok) {
      return promotionGuard;
    }

    const retryPolicy = resolveDispatchPolicyHooks(policyResult.queueClass, options);

    let providerName = 'codex';
    let provider = null;
    try {
      const resolvedProvider = this.providerRegistry.resolve(options.provider || 'codex');
      providerName = resolvedProvider.providerName;
      provider = resolvedProvider.provider;
    } catch (error) {
      return fail('unknown-provider', normalize(error?.message) || 'unknown execution provider', {
        taskId: resolvedTaskId,
        provider: normalize(options.provider) || 'codex',
      });
    }

    const providerAllowlist = this.enforceProviderAllowlist(policyResult.decision ?? {}, providerName, resolvedTaskId);
    if (!providerAllowlist.ok) {
      return providerAllowlist;
    }

    const redactionLevel = resolveRedactionLevel(policyResult.decision ?? {}, options);
    const redactionPolicy = new DispatchRedactionPolicy(redactionLevel);

    await this.appendEvent(
      'SubagentDispatchRequested',
      resolvedTaskId,
      {
        provider: providerName,
        agentId: resolvedAgent.agentId,
        childSessionId,
        scope,
        queueClass: policyResult.queueClass,
        policyAction: normalize(policyResult.decision?.action),
        policyPackId: normalize(policyResult.decision?.packId),
        requiredCapability: capabilityGuard.requiredCapability,
        capabilityPolicy: capabilityGuard.policy,
        capabilityOverride: Boolean(capabilityGuard.overridden),
        claimOverride: Boolean(claimGuard.overridden),
        releaseCritical: Boolean(promotionGuard.releaseCritical),
        promotionGateChecked: Boolean(promotionGuard.checked),
        promotionGateOverride: Boolean(promotionGuard.overridden),
        timeoutMs: retryPolicy.timeoutMs,
        maxRetries: retryPolicy.maxRetries,
        idempotencyKey,
        resumeDispatchId,
        resumed: canResumeDispatch,
        providerAllowlist: providerAllowlist.allowlist,
        redactionLevel,
      },
      { source: 'subagent-dispatch-runtime' }
    );

    await this.writeDispatchControlTask(resolvedTaskId, {
      taskId: resolvedTaskId,
      childSessionId,
      idempotencyKey,
      provider: providerName,
      dispatchId: resumeDispatchId,
      status: 'requested',
    });

    let claimAcquired = false;
    let releaseError = null;

    try {
      const acquired = await this.claimRuntime.acquire(resolvedTaskId, resolvedAgent.agentId, scope);
      if (!acquired.ok) {
        return acquired;
      }
      claimAcquired = true;

      const claimStatus = await this.claimRuntime.status(resolvedTaskId);
      if (!claimStatus.ok) {
        return claimStatus;
      }
      const activeClaim = claimStatus.claim ?? {};
      if (normalize(activeClaim.lastAgentId) !== normalize(resolvedAgent.agentId) || normalize(activeClaim.lastScope) !== scope) {
        return fail('claim-acquire-mismatch', 'active claim does not match requested dispatch context', {
          taskId: resolvedTaskId,
          agentId: normalize(resolvedAgent.agentId),
          scope,
          activeClaim,
        });
      }

      const spawned = await this.childSessionRuntime.spawn(resolvedTaskId, resolvedAgent.agentId, childSessionId);
      if (!spawned.ok) {
        return spawned;
      }

      const providerCommand = normalize(options.providerCommand || options.command);
      const providerArgs = Array.isArray(options.providerArgs) ? options.providerArgs.map(entry => String(entry ?? '')) : [];
      const providerCwd = normalize(options.providerCwd || options.cwd) || this.cwd;
      const providerGoal = String(options.goal ?? '');
      const providerPrompt = String(options.prompt ?? '');
      const providerModel = normalize(options.model);
      const providerReasoningEffort = normalize(options.reasoningEffort);
      const maxAttempts = retryPolicy.maxRetries + 1;
      const redactedCommand = redactionPolicy.redactCommand(providerCommand || 'codex');
      const redactedArgs = redactionPolicy.redactArgs(providerArgs);
      const redactedCwd = redactionPolicy.redactPath(providerCwd);
      const redactedGoal = redactionPolicy.metadata(providerGoal);
      const redactedPrompt = redactionPolicy.metadata(providerPrompt);

      let dispatchResult;
      let executionError = null;
      const dispatchAttempts = [];
      let activeDispatchId = canResumeDispatch ? resumeDispatchId : '';

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const dispatchStartedAt = nowIso(this.nowMs);

        await this.appendEvent(
          'SubagentDispatchStarted',
          resolvedTaskId,
          {
            provider: providerName,
            agentId: resolvedAgent.agentId,
            childSessionId,
            scope,
            queueClass: policyResult.queueClass,
            requiredCapability: capabilityGuard.requiredCapability,
            command: redactedCommand,
            args: redactedArgs,
            cwd: redactedCwd,
            goal: redactedGoal.redacted,
            goalHash: redactedGoal.hash,
            prompt: redactedPrompt.redacted,
            promptHash: redactedPrompt.hash,
            startedAt: dispatchStartedAt,
            timeoutMs: retryPolicy.timeoutMs,
            attempt,
            maxAttempts,
            idempotencyKey,
            dispatchId: activeDispatchId,
          },
          { source: 'subagent-dispatch-runtime' }
        );

        await this.writeDispatchControlTask(resolvedTaskId, {
          taskId: resolvedTaskId,
          childSessionId,
          idempotencyKey,
          provider: providerName,
          dispatchId: activeDispatchId,
          status: 'started',
          attempt,
          maxAttempts,
          timeoutMs: retryPolicy.timeoutMs,
        });

        dispatchResult = {
          ok: false,
          status: 'failed',
          exitCode: 1,
          codexAgentId: '',
          dispatchId: activeDispatchId,
          artifacts: [],
          stdout: '',
          stderr: '',
        };
        executionError = null;

        try {
          dispatchResult = await provider.dispatch({
            command: providerCommand,
            args: providerArgs,
            cwd: providerCwd,
            dryRun: Boolean(options.dryRun),
            taskId: resolvedTaskId,
            agentId: resolvedAgent.agentId,
            childSessionId,
            timeoutMs: retryPolicy.timeoutMs,
            goal: providerGoal,
            prompt: providerPrompt,
            model: providerModel,
            reasoningEffort: providerReasoningEffort,
            idempotencyKey,
            bridgeDispatchId: activeDispatchId,
            bridgeUrl: normalize(options.bridgeUrl),
            bridgeToken: normalize(options.bridgeToken),
            bridgePollIntervalMs: toPositiveNumber(options.bridgePollIntervalMs, 0),
            bridgePollTimeoutMs: toPositiveNumber(options.bridgePollTimeoutMs, 0),
            bridgeMockStatusesCsv: normalize(options.bridgeMockStatusesCsv),
            bridgeMockDispatchId: normalize(options.bridgeMockDispatchId),
            bridgeMockAgentId: normalize(options.bridgeMockAgentId),
            metadata: {
              queueClass: policyResult.queueClass,
              requiredCapability: capabilityGuard.requiredCapability,
              actor: (await this.getSessionContext()).actor,
            },
          });
        } catch (error) {
          executionError = error;
          dispatchResult = {
            ok: false,
            status: 'failed',
            exitCode: 1,
            codexAgentId: '',
            dispatchId: activeDispatchId,
            artifacts: [],
            stdout: '',
            stderr: '',
            errorMessage: normalize(error?.message || String(error)),
          };
        }

        const nextDispatchId = normalize(dispatchResult.dispatchId || activeDispatchId);
        if (nextDispatchId) {
          activeDispatchId = nextDispatchId;
        }

        const normalizedStatus = normalize(dispatchResult.status).toLowerCase();
        const canRetry = !dispatchResult.ok && RETRYABLE_STATUSES.has(normalizedStatus) && attempt < maxAttempts;
        dispatchAttempts.push({
          attempt,
          status: normalizedStatus || (dispatchResult.ok ? 'completed' : 'failed'),
          exitCode: toNumber(dispatchResult.exitCode, dispatchResult.ok ? 0 : 1),
          timeoutMs: retryPolicy.timeoutMs,
          retried: canRetry,
          dispatchId: activeDispatchId,
        });

        await this.writeDispatchControlTask(resolvedTaskId, {
          taskId: resolvedTaskId,
          childSessionId,
          idempotencyKey,
          provider: providerName,
          dispatchId: activeDispatchId,
          status: canRetry ? 'started' : (dispatchResult.ok ? 'completed' : 'failed'),
          attempt,
          maxAttempts,
          timeoutMs: retryPolicy.timeoutMs,
          lastStatus: normalizedStatus || (dispatchResult.ok ? 'completed' : 'failed'),
        });

        if (dispatchResult.ok || !canRetry) {
          break;
        }

        await this.appendEvent(
          'SubagentDispatchRetryScheduled',
          resolvedTaskId,
          {
            provider: providerName,
            agentId: resolvedAgent.agentId,
            childSessionId,
            scope,
            queueClass: policyResult.queueClass,
            reason: normalizedStatus || 'dispatch-failed',
            attempt,
            nextAttempt: attempt + 1,
            maxAttempts,
            timeoutMs: retryPolicy.timeoutMs,
            dispatchId: activeDispatchId,
          },
          { source: 'subagent-dispatch-runtime' }
        );
      }

      const artifactPath = this.resolveArtifactPath(resolvedTaskId, options);
      const artifactPayload = {
        taskId: resolvedTaskId,
        agentId: resolvedAgent.agentId,
        childSessionId,
        provider: providerName,
        dispatch: dispatchResult,
        dispatchAttempts,
        route: resolvedAgent.route,
        execution: {
          idempotencyKey,
          dispatchId: normalize(dispatchResult?.dispatchId || activeDispatchId),
          resumed: canResumeDispatch,
        },
        request: {
          command: redactedCommand,
          args: redactedArgs,
          cwd: redactedCwd,
          goal: redactedGoal,
          prompt: redactedPrompt,
          model: redactionPolicy.redactText(providerModel),
          reasoningEffort: redactionPolicy.redactText(providerReasoningEffort),
        },
        policy: {
          queueClass: policyResult.queueClass,
          decision: policyResult.decision ?? {},
        },
        capability: {
          requiredCapability: capabilityGuard.requiredCapability,
          policy: capabilityGuard.policy,
          reason: capabilityGuard.reason,
          override: Boolean(capabilityGuard.overridden),
        },
        promotion: {
          releaseCritical: Boolean(promotionGuard.releaseCritical),
          checked: Boolean(promotionGuard.checked),
          override: Boolean(promotionGuard.overridden),
          unmet: Array.isArray(promotionGuard.unmet) ? promotionGuard.unmet : [],
        },
        retryPolicy,
        redaction: {
          level: redactionLevel,
        },
        recordedAt: nowIso(this.nowMs),
      };
      await this.store.writeJson(artifactPath, artifactPayload);

      const attached = await this.verificationRuntime.attach(
        resolvedTaskId,
        normalize(options.evidenceKind) || 'subagent-dispatch',
        artifactPath,
        normalize(options.evidenceSummary) || `Dispatch artifact recorded (${normalize(dispatchResult.status) || 'unknown'})`
      );
      if (!attached.ok) {
        dispatchResult = {
          ...dispatchResult,
          ok: false,
          status: 'failed',
          errorMessage: normalize(attached.message) || 'failed to attach evidence',
        };
      }

      const verificationOutcome = deriveVerificationOutcome(dispatchResult, options.verifyOutcome);
      const verified = await this.verificationRuntime.verify(
        resolvedTaskId,
        verificationOutcome,
        normalize(options.verifySummary) || `Dispatch ${verificationOutcome}`
      );
      if (!verified.ok) {
        dispatchResult = {
          ...dispatchResult,
          ok: false,
          status: 'failed',
          errorMessage: normalize(verified.message) || 'failed to record verification',
        };
      }

      const terminalPayload = {
        provider: providerName,
        agentId: resolvedAgent.agentId,
        childSessionId,
        scope,
        queueClass: policyResult.queueClass,
        requiredCapability: capabilityGuard.requiredCapability,
        status: normalize(dispatchResult.status) || (dispatchResult.ok ? 'completed' : 'failed'),
        exitCode: toNumber(dispatchResult.exitCode, dispatchResult.ok ? 0 : 1),
        codexAgentId: normalize(dispatchResult.codexAgentId),
        dispatchId: normalize(dispatchResult.dispatchId),
        artifactPath,
        verificationOutcome,
        attempts: Array.isArray(artifactPayload.dispatchAttempts) ? artifactPayload.dispatchAttempts.length : 0,
        maxAttempts,
        timeoutMs: retryPolicy.timeoutMs,
      };

      if (dispatchResult.ok) {
        await this.appendEvent(
          'SubagentDispatchCompleted',
          resolvedTaskId,
          terminalPayload,
          { source: 'subagent-dispatch-runtime' }
        );
      } else {
        await this.appendEvent(
          'SubagentDispatchFailed',
          resolvedTaskId,
          {
            ...terminalPayload,
            errorCode: executionError
              ? 'provider-exception'
              : normalize(dispatchResult.status).toLowerCase() === 'timeout'
                ? 'dispatch-timeout'
                : 'dispatch-failed',
            errorMessage: normalize(dispatchResult.errorMessage) || normalize(dispatchResult.stderr),
          },
          { source: 'subagent-dispatch-runtime' }
        );
      }

      await this.writeDispatchControlTask(resolvedTaskId, {
        taskId: resolvedTaskId,
        childSessionId,
        idempotencyKey,
        provider: providerName,
        dispatchId: normalize(dispatchResult.dispatchId),
        status: dispatchResult.ok ? 'completed' : 'failed',
        artifactPath,
        verificationOutcome,
      });

      return {
        ok: Boolean(dispatchResult.ok),
        taskId: resolvedTaskId,
        agentId: resolvedAgent.agentId,
        childSessionId,
        provider: providerName,
        artifactPath,
        verificationOutcome,
        policy: {
          queueClass: policyResult.queueClass,
          decision: policyResult.decision ?? {},
        },
        redaction: {
          level: redactionLevel,
        },
        retryPolicy,
        dispatch: dispatchResult,
      };
    } finally {
      if (claimAcquired) {
        const released = await this.claimRuntime.release(resolvedTaskId, resolvedAgent.agentId, scope);
        if (!released.ok) {
          releaseError = released;
        }
      }
      if (releaseError) {
        return {
          ok: false,
          code: 'claim-release-failed',
          message: normalize(releaseError.message) || 'failed to release task claim',
          taskId: resolvedTaskId,
          release: releaseError,
        };
      }
    }
  }
}
