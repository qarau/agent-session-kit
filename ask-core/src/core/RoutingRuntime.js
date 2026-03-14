import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { AgentCapabilityRegistry } from '../policy/AgentCapabilityRegistry.js';
import { RoutingPolicyEngine } from '../policy/RoutingPolicyEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
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

export class RoutingRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.capabilityRegistry = new AgentCapabilityRegistry();
    this.policyEngine = new RoutingPolicyEngine();
  }

  async readTaskBoard() {
    return this.store.readJson(this.paths.taskBoardSnapshot(), { tasks: {} });
  }

  async readVerificationSnapshot() {
    return this.store.readJson(this.paths.verificationSnapshot(), { tasks: {} });
  }

  async readFreshnessSnapshot() {
    return this.store.readJson(this.paths.freshnessSnapshot(), { tasks: {} });
  }

  async readAgentsSnapshot() {
    return this.store.readJson(this.paths.agentsSnapshot(), { agents: {} });
  }

  async readRoutingSnapshot() {
    return this.store.readJson(this.paths.routingSnapshot(), { tasks: {} });
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
    await this.projectionEngine.replay();
  }

  async recommend(taskId, candidates = '') {
    const resolvedTaskId = normalize(taskId);
    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }

    const tasks = await this.readTaskBoard();
    const task = tasks.tasks?.[resolvedTaskId] ?? null;
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    const verification = (await this.readVerificationSnapshot()).tasks?.[resolvedTaskId] ?? null;
    const freshness = (await this.readFreshnessSnapshot()).tasks?.[resolvedTaskId] ?? null;
    const policy = this.policyEngine.recommend({ task, verification, freshness });

    const agents = await this.readAgentsSnapshot();
    const selected = this.capabilityRegistry.findAgent(policy.requiredCapability, agents.agents ?? {}, {
      candidates: list(candidates),
    });

    if (!selected) {
      return fail('no-agent-with-capability', `no agent has capability: ${policy.requiredCapability}`, {
        taskId: resolvedTaskId,
        requiredCapability: policy.requiredCapability,
      });
    }

    const recommendation = {
      taskId: resolvedTaskId,
      agentId: selected.agentId,
      requiredCapability: policy.requiredCapability,
      policy: policy.policy,
      reason: policy.reason,
    };

    await this.appendEvent(
      'RouteRecommended',
      resolvedTaskId,
      recommendation,
      { source: 'routing-runtime' }
    );

    const snapshot = await this.readRoutingSnapshot();
    return {
      ok: true,
      recommendation,
      routing: snapshot.tasks?.[resolvedTaskId] ?? null,
    };
  }

  async status(taskId = '') {
    const resolvedTaskId = normalize(taskId);
    const snapshot = await this.readRoutingSnapshot();
    const tasks = snapshot.tasks ?? {};
    if (!resolvedTaskId) {
      return { ok: true, tasks };
    }
    const task = tasks[resolvedTaskId];
    if (!task) {
      return fail('route-not-found', `route not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }
    return { ok: true, routing: task };
  }
}
