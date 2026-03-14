import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

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

function buildExplanation(task) {
  if (task.status === 'fresh') {
    return `Task ${task.taskId} is fresh. No dependency changed after verification pass.`;
  }
  if (task.status === 'stale') {
    const dependencies = Array.isArray(task.blockingDependencies) ? task.blockingDependencies : [];
    if (dependencies.length === 0) {
      return `Task ${task.taskId} is stale due to dependency updates.`;
    }
    return `Task ${task.taskId} is stale because dependency updates were detected: ${dependencies.join(', ')}.`;
  }
  return `Task ${task.taskId} is unverified because verification has not passed.`;
}

function normalizeTask(taskId, task) {
  const resolvedTaskId = normalize(taskId);
  const blockingDependencies = Array.isArray(task?.blockingDependencies)
    ? task.blockingDependencies.map(entry => normalize(entry)).filter(Boolean).sort()
    : [];
  return {
    taskId: resolvedTaskId,
    status: normalize(task?.status) || 'unverified',
    reasonCode: normalize(task?.reasonCode) || 'verification-not-passed',
    blockingDependencies,
  };
}

export class FreshnessRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async readSnapshot() {
    return this.store.readJson(this.paths.freshnessSnapshot(), { tasks: {} });
  }

  async status(taskId = '') {
    const resolvedTaskId = normalize(taskId);
    const snapshot = await this.readSnapshot();
    const tasks = snapshot.tasks ?? {};

    if (!resolvedTaskId) {
      const output = {};
      for (const [id, task] of Object.entries(tasks)) {
        output[id] = normalizeTask(id, task);
      }
      return { ok: true, tasks: output };
    }

    const task = tasks[resolvedTaskId];
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    return {
      ok: true,
      ...normalizeTask(resolvedTaskId, task),
    };
  }

  async explain(taskId) {
    const payload = await this.status(taskId);
    if (!payload.ok) {
      return payload;
    }
    return {
      ...payload,
      explanation: buildExplanation(payload),
    };
  }
}
