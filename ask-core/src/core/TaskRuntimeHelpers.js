export function normalizeTaskRuntimeValue(value) {
  return String(value ?? '').trim();
}

export function createTaskFreshness(input = {}) {
  return {
    status: normalizeTaskRuntimeValue(input.status) || 'unverified',
    reasonCode: normalizeTaskRuntimeValue(input.reasonCode) || 'verification-not-passed',
    blockingDependencies: Array.isArray(input.blockingDependencies)
      ? input.blockingDependencies.map(value => normalizeTaskRuntimeValue(value)).filter(Boolean)
      : [],
  };
}

export function enrichTaskWithFreshness(task, freshness = {}) {
  return {
    ...task,
    freshness: createTaskFreshness(freshness),
  };
}

export function buildTaskCreatedPayload(title, description = '') {
  return {
    title: normalizeTaskRuntimeValue(title),
    description: normalizeTaskRuntimeValue(description),
  };
}

export function buildTaskAssignedPayload(owner) {
  return {
    owner: normalizeTaskRuntimeValue(owner),
  };
}

export function buildTaskReopenedPayload(reason = '') {
  return {
    reason: normalizeTaskRuntimeValue(reason),
  };
}

export function buildTaskDependencyAddedPayload(dependencyTaskId) {
  return {
    dependencyTaskId: normalizeTaskRuntimeValue(dependencyTaskId),
  };
}

export function okTaskResult(task) {
  return {
    ok: true,
    task,
  };
}
