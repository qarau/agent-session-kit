function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTaskState(previous = {}) {
  return {
    status: normalize(previous.status),
    lastAgentId: normalize(previous.lastAgentId),
    lastScope: normalize(previous.lastScope),
    lock: previous.lock ? { ...previous.lock } : null,
    updatedAt: normalize(previous.updatedAt),
    lastEventSeq: toNumber(previous.lastEventSeq),
    lastEventType: normalize(previous.lastEventType),
  };
}

function withTask(state, taskId, task, event) {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: {
        ...task,
        updatedAt: normalize(event.ts),
        lastEventSeq: toNumber(event.seq),
        lastEventType: normalize(event.type),
      },
    },
  };
}

export class ClaimProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalize(event.taskId);
    if (!taskId) {
      return state;
    }

    const type = normalize(event.type);
    const payload = event.payload ?? {};
    const task = createTaskState(state.tasks?.[taskId]);

    if (type === 'TaskClaimAcquired') {
      return withTask(
        state,
        taskId,
        {
          ...task,
          status: 'acquired',
          lastAgentId: normalize(payload.agentId),
          lastScope: normalize(payload.scope),
        },
        event
      );
    }

    if (type === 'TaskClaimReleased') {
      return withTask(
        state,
        taskId,
        {
          ...task,
          status: 'released',
          lastAgentId: normalize(payload.agentId),
          lastScope: normalize(payload.scope),
        },
        event
      );
    }

    if (type === 'TaskClaimLocked') {
      return withTask(
        state,
        taskId,
        {
          ...task,
          status: 'locked',
          lastAgentId: normalize(payload.agentId),
          lastScope: normalize(payload.scope),
          lock: {
            agentId: normalize(payload.agentId),
            scope: normalize(payload.scope),
            at: normalize(event.ts),
            seq: toNumber(event.seq),
          },
        },
        event
      );
    }

    return state;
  }
}
