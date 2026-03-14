import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';

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

export class AgentRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async readAgentsSnapshot() {
    return this.store.readJson(this.paths.agentsSnapshot(), { agents: {} });
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

  async appendEvent(type, payload = {}, meta = {}) {
    const context = await this.getSessionContext();
    await this.ledger.append({
      type,
      sessionId: context.sessionId,
      taskId: '',
      actor: context.actor,
      payload,
      meta,
    });
    await this.projectionEngine.replay();
  }

  async register(agentId, capabilities = '') {
    const resolvedAgentId = normalize(agentId);
    if (!resolvedAgentId) {
      return fail('missing-agent-id', 'agent id is required');
    }

    const resolvedCapabilities = list(capabilities);
    if (resolvedCapabilities.length === 0) {
      return fail('missing-capabilities', 'agent capabilities are required', {
        agentId: resolvedAgentId,
      });
    }

    await this.appendEvent(
      'AgentRegistered',
      {
        agentId: resolvedAgentId,
        capabilities: resolvedCapabilities,
      },
      { source: 'agent-runtime' }
    );

    const snapshot = await this.readAgentsSnapshot();
    return {
      ok: true,
      agent: snapshot.agents?.[resolvedAgentId] ?? null,
    };
  }

  async status(agentId = '') {
    const resolvedAgentId = normalize(agentId);
    const snapshot = await this.readAgentsSnapshot();
    const agents = snapshot.agents ?? {};

    if (!resolvedAgentId) {
      return { ok: true, agents };
    }

    const agent = agents[resolvedAgentId];
    if (!agent) {
      return fail('agent-not-found', `agent not found: ${resolvedAgentId}`, { agentId: resolvedAgentId });
    }

    return { ok: true, agent };
  }
}
