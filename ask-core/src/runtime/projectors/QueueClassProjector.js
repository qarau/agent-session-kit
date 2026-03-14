function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTaskState(previous = {}) {
  return {
    latestClass: normalize(previous.latestClass),
    history: Array.isArray(previous.history) ? [...previous.history] : [],
    updatedAt: normalize(previous.updatedAt),
    lastEventSeq: toNumber(previous.lastEventSeq),
    lastEventType: normalize(previous.lastEventType),
  };
}

function withTask(state, taskId, taskState, event) {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: {
        ...taskState,
        updatedAt: normalize(event.ts),
        lastEventSeq: toNumber(event.seq),
        lastEventType: normalize(event.type),
      },
    },
  };
}

export class QueueClassProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalize(event.taskId);
    if (!taskId || normalize(event.type) !== 'TaskClassified') {
      return state;
    }

    const task = createTaskState(state.tasks?.[taskId]);
    const queueClass = normalize(event.payload?.queueClass).toLowerCase();
    if (!queueClass) {
      return state;
    }

    const history = [
      ...task.history,
      {
        queueClass,
        at: normalize(event.ts),
        seq: toNumber(event.seq),
      },
    ];

    return withTask(
      state,
      taskId,
      {
        ...task,
        latestClass: queueClass,
        history,
      },
      event
    );
  }
}
