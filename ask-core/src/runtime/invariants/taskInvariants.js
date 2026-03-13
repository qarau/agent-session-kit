function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function normalize(value) {
  return String(value ?? '').trim();
}

export function validateTaskCreate({ taskId, title, existing }) {
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

export function validateTaskAssign({ taskId, owner, task }) {
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

export function validateTaskStart({ taskId, task }) {
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
