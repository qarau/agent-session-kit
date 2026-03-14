import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function defaultChildSessionId(taskId) {
  return `${normalize(taskId)}_child_${Date.now().toString(36)}`;
}

export class ChildSessionRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async readTaskBoard() {
    return this.store.readJson(this.paths.taskBoardSnapshot(), { tasks: {} });
  }

  async readAgentsSnapshot() {
    return this.store.readJson(this.paths.agentsSnapshot(), { agents: {} });
  }

  async readChildSessionsSnapshot() {
    return this.store.readJson(this.paths.childSessionsSnapshot(), { tasks: {} });
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

  async spawn(taskId, agentId, childSessionId = '') {
    const resolvedTaskId = normalize(taskId);
    const resolvedAgentId = normalize(agentId);
    const resolvedChildSessionId = normalize(childSessionId) || defaultChildSessionId(resolvedTaskId);

    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }
    if (!resolvedAgentId) {
      return fail('missing-agent-id', 'agent id is required', { taskId: resolvedTaskId });
    }

    const tasks = await this.readTaskBoard();
    if (!tasks.tasks?.[resolvedTaskId]) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    const agents = await this.readAgentsSnapshot();
    if (!agents.agents?.[resolvedAgentId]) {
      return fail('agent-not-found', `agent not found: ${resolvedAgentId}`, { agentId: resolvedAgentId });
    }

    const context = await this.getSessionContext();
    await this.appendEvent(
      'ChildSessionCreated',
      resolvedTaskId,
      {
        childSessionId: resolvedChildSessionId,
        agentId: resolvedAgentId,
        parentSessionId: context.sessionId,
      },
      { source: 'child-session-runtime' }
    );

    const snapshot = await this.readChildSessionsSnapshot();
    return {
      ok: true,
      childSession: snapshot.tasks?.[resolvedTaskId]?.latest ?? null,
    };
  }

  async status(taskId = '') {
    const resolvedTaskId = normalize(taskId);
    const snapshot = await this.readChildSessionsSnapshot();
    const tasks = snapshot.tasks ?? {};

    if (!resolvedTaskId) {
      return { ok: true, tasks };
    }

    const record = tasks[resolvedTaskId];
    if (!record) {
      return fail('child-session-not-found', `child session not found: ${resolvedTaskId}`, {
        taskId: resolvedTaskId,
      });
    }
    return { ok: true, task: record };
  }
}
