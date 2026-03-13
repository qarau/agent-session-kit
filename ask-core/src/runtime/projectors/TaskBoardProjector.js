function normalizeTaskId(event) {
  const taskId = String(event.taskId ?? '').trim();
  return taskId;
}

function createTaskBase(taskId, event, previous) {
  return {
    taskId,
    status: previous?.status ?? 'created',
    title: String(previous?.title ?? ''),
    description: String(previous?.description ?? ''),
    owner: String(previous?.owner ?? ''),
    createdAt: previous?.createdAt || String(event.ts ?? ''),
    updatedAt: String(event.ts ?? ''),
    lastEventSeq: Number(event.seq ?? 0),
    lastEventType: String(event.type ?? ''),
  };
}

function withTask(state, taskId, task) {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: task,
    },
  };
}

export class TaskBoardProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalizeTaskId(event);
    if (!taskId) {
      return state;
    }

    const current = state.tasks[taskId];
    const base = createTaskBase(taskId, event, current);
    const type = String(event.type ?? '');

    if (type === 'TaskCreated') {
      return withTask(state, taskId, {
        ...base,
        status: 'created',
        title: String(event.payload?.title ?? base.title),
        description: String(event.payload?.description ?? base.description),
      });
    }

    if (type === 'TaskAssigned') {
      return withTask(state, taskId, {
        ...base,
        owner: String(event.payload?.owner ?? base.owner),
      });
    }

    if (type === 'TaskStarted') {
      return withTask(state, taskId, {
        ...base,
        status: 'in-progress',
      });
    }

    if (type === 'TaskCompleted') {
      return withTask(state, taskId, {
        ...base,
        status: 'completed',
      });
    }

    if (type === 'TaskBlocked') {
      return withTask(state, taskId, {
        ...base,
        status: 'blocked',
      });
    }

    return state;
  }
}
