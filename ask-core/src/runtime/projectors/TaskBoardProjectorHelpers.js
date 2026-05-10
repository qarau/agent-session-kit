export function normalizeTaskBoardTaskId(value) {
  return String(value ?? '').trim();
}

export function cloneTaskBoardObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : null;
}

export function normalizeAcceptanceCriteria(value) {
  return Array.isArray(value)
    ? value.map(entry => String(entry ?? '').trim()).filter(Boolean)
    : [];
}

export function createTaskBoardBase(taskId, event, previous) {
  return {
    taskId,
    status: previous?.status ?? 'created',
    title: String(previous?.title ?? ''),
    description: String(previous?.description ?? ''),
    origin: cloneTaskBoardObject(previous?.origin),
    acceptanceCriteria: Array.isArray(previous?.acceptanceCriteria) ? [...previous.acceptanceCriteria] : [],
    queueClassHint: String(previous?.queueClassHint ?? ''),
    refactorGovernance: cloneTaskBoardObject(previous?.refactorGovernance),
    owner: String(previous?.owner ?? ''),
    dependencies: Array.isArray(previous?.dependencies) ? [...previous.dependencies] : [],
    createdAt: previous?.createdAt || String(event.ts ?? ''),
    updatedAt: String(event.ts ?? ''),
    lastEventSeq: Number(event.seq ?? 0),
    lastEventType: String(event.type ?? ''),
  };
}

export function withTaskBoardTask(state, taskId, task) {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: task,
    },
  };
}

export function mergeTaskBoardDependencies(previous = [], dependencyTaskId) {
  const dependencies = new Set(previous);
  const normalizedDependencyTaskId = normalizeTaskBoardTaskId(dependencyTaskId);
  if (normalizedDependencyTaskId) {
    dependencies.add(normalizedDependencyTaskId);
  }
  return Array.from(dependencies).sort();
}
