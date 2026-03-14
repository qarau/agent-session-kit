function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTaskState(previous = {}, taskId = '') {
  return {
    taskId: normalize(previous.taskId) || normalize(taskId),
    status: normalize(previous.status) || 'revoked',
    reasonCode: normalize(previous.reasonCode) || 'integration-missing',
    runId: normalize(previous.runId),
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
        taskId,
        updatedAt: normalize(event.ts),
        lastEventSeq: toNumber(event.seq),
        lastEventType: normalize(event.type),
      },
    },
  };
}

export class MergeReadinessProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalize(event.taskId);
    if (!taskId) {
      return state;
    }

    const current = createTaskState(state.tasks?.[taskId], taskId);
    const type = normalize(event.type);
    const runId = normalize(event.payload?.runId);

    if (type === 'TaskCreated') {
      return withTask(
        state,
        taskId,
        {
          ...current,
          status: 'revoked',
          reasonCode: 'integration-missing',
          runId: '',
        },
        event
      );
    }

    if (type === 'IntegrationRunPassed') {
      return withTask(
        state,
        taskId,
        {
          ...current,
          status: 'ready',
          reasonCode: 'integration-passed',
          runId,
        },
        event
      );
    }

    if (type === 'IntegrationRunFailed') {
      return withTask(
        state,
        taskId,
        {
          ...current,
          status: 'revoked',
          reasonCode: 'integration-failed',
          runId,
        },
        event
      );
    }

    return state;
  }
}
