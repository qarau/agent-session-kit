export type AskTaskInvariantSuccess = {
  ok: true;
};

export type AskTaskInvariantFailure = {
  ok: false;
  code: string;
  message: string;
  taskId?: string;
  dependencyTaskId?: string;
  from?: string;
  to?: string;
  allowedFrom?: string[];
};

export type AskTaskInvariantDecision = AskTaskInvariantSuccess | AskTaskInvariantFailure;

export type AskTaskInvariantTask = {
  status?: string;
  dependencies?: string[];
};

function fail(code: string, message: string, extra: Omit<AskTaskInvariantFailure, 'ok' | 'code' | 'message'> = {}): AskTaskInvariantFailure {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

export function validateTaskCreate({
  taskId,
  title,
  existing,
}: {
  taskId: unknown;
  title: unknown;
  existing: unknown;
}): AskTaskInvariantDecision {
  const resolvedTaskId = normalize(taskId);
  if (!resolvedTaskId) {
    return fail('missing-task-id', 'task id is required');
  }
  if (!normalize(title)) {
    return fail('missing-title', 'task title is required');
  }
  if (existing) {
    return fail('task-exists', `task already exists: ${resolvedTaskId}`, { taskId: resolvedTaskId });
  }
  return { ok: true };
}

export function validateTaskAssign({
  taskId,
  owner,
  task,
}: {
  taskId: unknown;
  owner: unknown;
  task: AskTaskInvariantTask | null | undefined;
}): AskTaskInvariantDecision {
  const resolvedTaskId = normalize(taskId);
  if (!resolvedTaskId) {
    return fail('missing-task-id', 'task id is required');
  }
  if (!normalize(owner)) {
    return fail('missing-owner', 'task owner is required');
  }
  if (!task) {
    return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
  }
  if (task.status === 'completed' || task.status === 'blocked') {
    return fail('invalid-task-transition', `cannot assign task in status ${task.status}`, {
      taskId: resolvedTaskId,
      from: task.status,
      allowedFrom: ['created', 'in-progress'],
      to: 'assigned',
    });
  }
  return { ok: true };
}

export function validateTaskStart({
  taskId,
  task,
}: {
  taskId: unknown;
  task: AskTaskInvariantTask | null | undefined;
}): AskTaskInvariantDecision {
  const resolvedTaskId = normalize(taskId);
  if (!resolvedTaskId) {
    return fail('missing-task-id', 'task id is required');
  }
  if (!task) {
    return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
  }
  if (task.status !== 'created') {
    return fail('invalid-task-transition', `cannot start task from ${task.status}`, {
      taskId: resolvedTaskId,
      from: task.status,
      allowedFrom: ['created'],
      to: 'in-progress',
    });
  }
  return { ok: true };
}

export function validateTaskComplete({
  taskId,
  task,
}: {
  taskId: unknown;
  task: AskTaskInvariantTask | null | undefined;
}): AskTaskInvariantDecision {
  const resolvedTaskId = normalize(taskId);
  if (!resolvedTaskId) {
    return fail('missing-task-id', 'task id is required');
  }
  if (!task) {
    return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
  }
  if (task.status !== 'in-progress') {
    return fail('invalid-task-transition', `cannot complete task from ${task.status}`, {
      taskId: resolvedTaskId,
      from: task.status,
      allowedFrom: ['in-progress'],
      to: 'completed',
    });
  }
  return { ok: true };
}

export function validateTaskReopen({
  taskId,
  task,
}: {
  taskId: unknown;
  task: AskTaskInvariantTask | null | undefined;
}): AskTaskInvariantDecision {
  const resolvedTaskId = normalize(taskId);
  if (!resolvedTaskId) {
    return fail('missing-task-id', 'task id is required');
  }
  if (!task) {
    return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
  }
  if (task.status !== 'completed' && task.status !== 'blocked') {
    return fail('invalid-task-transition', `cannot reopen task from ${task.status}`, {
      taskId: resolvedTaskId,
      from: task.status,
      allowedFrom: ['completed', 'blocked'],
      to: 'in-progress',
    });
  }
  return { ok: true };
}

export function validateTaskDepends({
  taskId,
  dependencyTaskId,
  task,
  dependencyTask,
}: {
  taskId: unknown;
  dependencyTaskId: unknown;
  task: AskTaskInvariantTask | null | undefined;
  dependencyTask: AskTaskInvariantTask | null | undefined;
}): AskTaskInvariantDecision {
  const resolvedTaskId = normalize(taskId);
  const resolvedDependencyTaskId = normalize(dependencyTaskId);
  if (!resolvedTaskId) {
    return fail('missing-task-id', 'task id is required');
  }
  if (!resolvedDependencyTaskId) {
    return fail('missing-dependency-task-id', 'dependency task id is required');
  }
  if (!task) {
    return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
  }
  if (!dependencyTask) {
    return fail('dependency-task-not-found', `dependency task not found: ${resolvedDependencyTaskId}`, {
      taskId: resolvedTaskId,
      dependencyTaskId: resolvedDependencyTaskId,
    });
  }
  if (resolvedTaskId === resolvedDependencyTaskId) {
    return fail('invalid-task-dependency', 'task cannot depend on itself', {
      taskId: resolvedTaskId,
      dependencyTaskId: resolvedDependencyTaskId,
    });
  }

  const dependencies = Array.isArray(task.dependencies) ? task.dependencies : [];
  if (dependencies.includes(resolvedDependencyTaskId)) {
    return fail('dependency-exists', `dependency already exists: ${resolvedDependencyTaskId}`, {
      taskId: resolvedTaskId,
      dependencyTaskId: resolvedDependencyTaskId,
    });
  }

  return { ok: true };
}
