function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTaskState(previous = {}) {
  return {
    latest: previous.latest ?? null,
    sessions: previous.sessions ? [...previous.sessions] : [],
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

export class ChildSessionProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalize(event.taskId);
    if (!taskId) {
      return state;
    }

    if (normalize(event.type) !== 'ChildSessionCreated') {
      return state;
    }

    const payload = event.payload ?? {};
    const session = {
      childSessionId: normalize(payload.childSessionId),
      agentId: normalize(payload.agentId),
      parentSessionId: normalize(payload.parentSessionId),
      at: normalize(event.ts),
      seq: toNumber(event.seq),
    };

    const taskState = createTaskState(state.tasks?.[taskId]);
    const sessions = [...taskState.sessions, session];

    return withTask(
      state,
      taskId,
      {
        ...taskState,
        latest: session,
        sessions,
      },
      event
    );
  }
}
