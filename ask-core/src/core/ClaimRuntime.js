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

export class ClaimRuntime {
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

  async readClaimsSnapshot() {
    return this.store.readJson(this.paths.claimsSnapshot(), { tasks: {} });
  }

  async getTask(taskId) {
    const board = await this.readTaskBoard();
    return board.tasks?.[normalize(taskId)] ?? null;
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

  async mutate(type, taskId, agentId, scope = 'task') {
    const resolvedTaskId = normalize(taskId);
    const resolvedAgentId = normalize(agentId);
    const resolvedScope = normalize(scope) || 'task';

    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }
    if (!resolvedAgentId) {
      return fail('missing-agent-id', 'agent id is required', { taskId: resolvedTaskId });
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    await this.appendEvent(
      type,
      resolvedTaskId,
      {
        agentId: resolvedAgentId,
        scope: resolvedScope,
      },
      { source: 'claim-runtime' }
    );

    const snapshot = await this.readClaimsSnapshot();
    return {
      ok: true,
      claim: snapshot.tasks?.[resolvedTaskId] ?? null,
    };
  }

  async acquire(taskId, agentId, scope = 'task') {
    return this.mutate('TaskClaimAcquired', taskId, agentId, scope);
  }

  async release(taskId, agentId, scope = 'task') {
    return this.mutate('TaskClaimReleased', taskId, agentId, scope);
  }

  async lock(taskId, agentId, scope = 'task') {
    return this.mutate('TaskClaimLocked', taskId, agentId, scope);
  }

  async status(taskId = '') {
    const resolvedTaskId = normalize(taskId);
    const snapshot = await this.readClaimsSnapshot();
    const tasks = snapshot.tasks ?? {};

    if (!resolvedTaskId) {
      return { ok: true, tasks };
    }

    const claim = tasks[resolvedTaskId];
    if (!claim) {
      return fail('claim-not-found', `claim not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }
    return { ok: true, claim };
  }
}
