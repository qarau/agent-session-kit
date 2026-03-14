function normalizeTaskId(event) {
  return String(event.taskId ?? '').trim();
}

function createTaskVerification(taskId, event, previous) {
  return {
    taskId,
    status: String(previous?.status ?? 'unknown'),
    summary: String(previous?.summary ?? ''),
    updatedAt: String(event.ts ?? ''),
    lastEventSeq: Number(event.seq ?? 0),
    lastEventType: String(event.type ?? ''),
    evidenceCount: Number(previous?.evidenceCount ?? 0),
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

export class VerificationProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalizeTaskId(event);
    if (!taskId) {
      return state;
    }

    const current = state.tasks[taskId];
    const base = createTaskVerification(taskId, event, current);
    const type = String(event.type ?? '');

    if (type === 'VerificationPassed') {
      return withTask(state, taskId, {
        ...base,
        status: 'passed',
        summary: String(event.payload?.summary ?? base.summary),
      });
    }

    if (type === 'VerificationFailed') {
      return withTask(state, taskId, {
        ...base,
        status: 'failed',
        summary: String(event.payload?.summary ?? base.summary),
      });
    }

    if (type === 'EvidenceAttached') {
      return withTask(state, taskId, {
        ...base,
        status: base.status,
        evidenceCount: base.evidenceCount + 1,
      });
    }

    return state;
  }
}
