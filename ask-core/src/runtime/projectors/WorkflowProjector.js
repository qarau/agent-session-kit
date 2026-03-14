function normalizeTaskId(event) {
  return String(event.taskId ?? '').trim();
}

function normalizeRunId(payload) {
  return String(payload?.runId ?? '').trim();
}

function createTaskState(previous = {}) {
  return {
    recommendation: previous.recommendation ?? null,
    runs: previous.runs ? { ...previous.runs } : {},
    lastEventSeq: Number(previous.lastEventSeq ?? 0),
    lastEventType: String(previous.lastEventType ?? ''),
    updatedAt: String(previous.updatedAt ?? ''),
  };
}

function applyRecommendation(taskState, event) {
  const payload = event.payload ?? {};
  return {
    ...taskState,
    recommendation: {
      workflow: String(payload.workflow ?? ''),
      skill: String(payload.skill ?? ''),
      reason: String(payload.reason ?? ''),
      at: String(event.ts ?? ''),
      seq: Number(event.seq ?? 0),
    },
  };
}

function applyRunStarted(taskState, event) {
  const payload = event.payload ?? {};
  const runId = normalizeRunId(payload);
  if (!runId) {
    return taskState;
  }
  return {
    ...taskState,
    runs: {
      ...taskState.runs,
      [runId]: {
        runId,
        workflow: String(payload.workflow ?? ''),
        skill: String(payload.skill ?? ''),
        status: 'running',
        summary: '',
        artifacts: [],
        startedAt: String(event.ts ?? ''),
        updatedAt: String(event.ts ?? ''),
      },
    },
  };
}

function applyArtifactRecorded(taskState, event) {
  const payload = event.payload ?? {};
  const runId = normalizeRunId(payload);
  if (!runId) {
    return taskState;
  }

  const current = taskState.runs[runId] ?? {
    runId,
    workflow: '',
    skill: '',
    status: 'running',
    summary: '',
    artifacts: [],
    startedAt: String(event.ts ?? ''),
    updatedAt: String(event.ts ?? ''),
  };
  const artifacts = Array.isArray(current.artifacts) ? [...current.artifacts] : [];
  artifacts.push({
    type: String(payload.type ?? ''),
    path: String(payload.path ?? ''),
    summary: String(payload.summary ?? ''),
    at: String(event.ts ?? ''),
    seq: Number(event.seq ?? 0),
  });

  return {
    ...taskState,
    runs: {
      ...taskState.runs,
      [runId]: {
        ...current,
        artifacts,
        updatedAt: String(event.ts ?? ''),
      },
    },
  };
}

function applyRunTerminal(taskState, event, status) {
  const payload = event.payload ?? {};
  const runId = normalizeRunId(payload);
  if (!runId) {
    return taskState;
  }

  const current = taskState.runs[runId] ?? {
    runId,
    workflow: String(payload.workflow ?? ''),
    skill: String(payload.skill ?? ''),
    status: 'running',
    summary: '',
    artifacts: [],
    startedAt: String(event.ts ?? ''),
    updatedAt: String(event.ts ?? ''),
  };
  return {
    ...taskState,
    runs: {
      ...taskState.runs,
      [runId]: {
        ...current,
        status,
        summary: String(payload.summary ?? ''),
        updatedAt: String(event.ts ?? ''),
      },
    },
  };
}

function withTask(state, taskId, taskState, event) {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: {
        ...taskState,
        lastEventSeq: Number(event.seq ?? 0),
        lastEventType: String(event.type ?? ''),
        updatedAt: String(event.ts ?? ''),
      },
    },
  };
}

export class WorkflowProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalizeTaskId(event);
    if (!taskId) {
      return state;
    }

    const current = createTaskState(state.tasks?.[taskId]);
    const type = String(event.type ?? '');

    if (type === 'WorkflowRecommended') {
      return withTask(state, taskId, applyRecommendation(current, event), event);
    }
    if (type === 'WorkflowRunStarted') {
      return withTask(state, taskId, applyRunStarted(current, event), event);
    }
    if (type === 'WorkflowArtifactRecorded') {
      return withTask(state, taskId, applyArtifactRecorded(current, event), event);
    }
    if (type === 'WorkflowRunCompleted') {
      return withTask(state, taskId, applyRunTerminal(current, event, 'completed'), event);
    }
    if (type === 'WorkflowRunFailed') {
      return withTask(state, taskId, applyRunTerminal(current, event, 'failed'), event);
    }
    return state;
  }
}
