import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import {
  validateTaskAssign,
  validateTaskCreate,
  validateTaskDepends,
  validateTaskStart,
} from '../runtime/invariants/taskInvariants.js';

function normalize(value) {
  return String(value ?? '').trim();
}

export class TaskRuntime {
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

  async readFreshness() {
    return this.store.readJson(this.paths.freshnessSnapshot(), { tasks: {} });
  }

  async getTask(taskId) {
    const board = await this.readTaskBoard();
    return board.tasks?.[normalize(taskId)] ?? null;
  }

  async getActiveSessionContext() {
    const session = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    return {
      sessionId: String(session.sessionId || ''),
      actor: String(session.actorId || 'local'),
    };
  }

  async appendTaskEvent(type, taskId, payload = {}, meta = {}) {
    const context = await this.getActiveSessionContext();
    await this.ledger.append({
      type,
      sessionId: context.sessionId,
      taskId: normalize(taskId),
      actor: context.actor,
      payload,
      meta,
    });
    await this.projectionEngine.replay();
    const board = await this.readTaskBoard();
    return board.tasks?.[normalize(taskId)] ?? null;
  }

  async create(taskId, title, description = '') {
    const resolvedTaskId = normalize(taskId);
    const board = await this.readTaskBoard();
    const existing = board.tasks?.[resolvedTaskId] ?? null;
    const decision = validateTaskCreate({
      taskId: resolvedTaskId,
      title,
      existing,
    });
    if (!decision.ok) {
      return decision;
    }

    const task = await this.appendTaskEvent(
      'TaskCreated',
      resolvedTaskId,
      {
        title: normalize(title),
        description: normalize(description),
      },
      { source: 'task-runtime' }
    );
    return { ok: true, task };
  }

  async assign(taskId, owner) {
    const resolvedTaskId = normalize(taskId);
    const task = await this.getTask(resolvedTaskId);
    const decision = validateTaskAssign({
      taskId: resolvedTaskId,
      owner,
      task,
    });
    if (!decision.ok) {
      return decision;
    }

    const updated = await this.appendTaskEvent(
      'TaskAssigned',
      resolvedTaskId,
      {
        owner: normalize(owner),
      },
      { source: 'task-runtime' }
    );
    return { ok: true, task: updated };
  }

  async start(taskId) {
    const resolvedTaskId = normalize(taskId);
    const task = await this.getTask(resolvedTaskId);
    const decision = validateTaskStart({
      taskId: resolvedTaskId,
      task,
    });
    if (!decision.ok) {
      return decision;
    }

    const updated = await this.appendTaskEvent(
      'TaskStarted',
      resolvedTaskId,
      {},
      { source: 'task-runtime' }
    );
    return { ok: true, task: updated };
  }

  async depends(taskId, dependencyTaskId) {
    const resolvedTaskId = normalize(taskId);
    const resolvedDependencyTaskId = normalize(dependencyTaskId);
    const task = await this.getTask(resolvedTaskId);
    const dependencyTask = await this.getTask(resolvedDependencyTaskId);
    const decision = validateTaskDepends({
      taskId: resolvedTaskId,
      dependencyTaskId: resolvedDependencyTaskId,
      task,
      dependencyTask,
    });
    if (!decision.ok) {
      return decision;
    }

    const updated = await this.appendTaskEvent(
      'TaskDependencyAdded',
      resolvedTaskId,
      {
        dependencyTaskId: resolvedDependencyTaskId,
      },
      { source: 'task-runtime' }
    );
    return { ok: true, task: updated };
  }

  async status(taskId = '') {
    const resolvedTaskId = normalize(taskId);
    const board = await this.readTaskBoard();
    const freshness = await this.readFreshness();
    const tasks = board.tasks ?? {};
    const freshnessTasks = freshness.tasks ?? {};

    if (!resolvedTaskId) {
      const enriched = {};
      for (const [id, task] of Object.entries(tasks)) {
        const taskFreshness = freshnessTasks[id] ?? {};
        enriched[id] = {
          ...task,
          freshness: {
            status: normalize(taskFreshness.status) || 'unverified',
            reasonCode: normalize(taskFreshness.reasonCode) || 'verification-not-passed',
            blockingDependencies: Array.isArray(taskFreshness.blockingDependencies)
              ? [...taskFreshness.blockingDependencies]
              : [],
          },
        };
      }
      return { ok: true, tasks: enriched };
    }

    const task = tasks[resolvedTaskId];
    if (!task) {
      return {
        ok: false,
        code: 'task-not-found',
        message: `task not found: ${resolvedTaskId}`,
        taskId: resolvedTaskId,
      };
    }
    const taskFreshness = freshnessTasks[resolvedTaskId] ?? {};
    return {
      ok: true,
      task: {
        ...task,
        freshness: {
          status: normalize(taskFreshness.status) || 'unverified',
          reasonCode: normalize(taskFreshness.reasonCode) || 'verification-not-passed',
          blockingDependencies: Array.isArray(taskFreshness.blockingDependencies)
            ? [...taskFreshness.blockingDependencies]
            : [],
        },
      },
    };
  }
}
