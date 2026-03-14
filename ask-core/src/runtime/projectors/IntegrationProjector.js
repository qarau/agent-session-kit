function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTaskState(previous = {}) {
  return {
    latestPlan: previous.latestPlan ?? null,
    latestRun: previous.latestRun ?? null,
    runs: previous.runs ? { ...previous.runs } : {},
    lastEventSeq: toNumber(previous.lastEventSeq),
    lastEventType: normalize(previous.lastEventType),
    updatedAt: normalize(previous.updatedAt),
  };
}

function withTask(state, taskId, taskState, event) {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: {
        ...taskState,
        lastEventSeq: toNumber(event.seq),
        lastEventType: normalize(event.type),
        updatedAt: normalize(event.ts),
      },
    },
  };
}

function ensureRun(taskState, runId, event) {
  const existing = taskState.runs[runId] ?? {
    runId,
    status: 'running',
    command: '',
    workspacePath: '',
    startedAt: normalize(event.ts),
    completedAt: '',
    exitCode: 0,
    summary: '',
  };
  return {
    ...existing,
    runId,
  };
}

export class IntegrationProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalize(event.taskId);
    if (!taskId) {
      return state;
    }

    const taskState = createTaskState(state.tasks?.[taskId]);
    const type = normalize(event.type);
    const payload = event.payload ?? {};

    if (type === 'IntegrationPlanCreated') {
      return withTask(
        state,
        taskId,
        {
          ...taskState,
          latestPlan: {
            runId: normalize(payload.runId),
            baseBranch: normalize(payload.baseBranch),
            headBranch: normalize(payload.headBranch),
            strategy: normalize(payload.strategy) || 'merge',
            plannedAt: normalize(payload.plannedAt) || normalize(event.ts),
          },
        },
        event
      );
    }

    if (type === 'IntegrationRunStarted') {
      const runId = normalize(payload.runId);
      if (!runId) {
        return state;
      }
      const run = ensureRun(taskState, runId, event);
      const next = {
        ...run,
        status: 'running',
        command: normalize(payload.command),
        workspacePath: normalize(payload.workspacePath),
        startedAt: normalize(event.ts),
      };
      return withTask(
        state,
        taskId,
        {
          ...taskState,
          runs: {
            ...taskState.runs,
            [runId]: next,
          },
          latestRun: next,
        },
        event
      );
    }

    if (type === 'IntegrationRunPassed' || type === 'IntegrationRunFailed') {
      const runId = normalize(payload.runId);
      if (!runId) {
        return state;
      }
      const run = ensureRun(taskState, runId, event);
      const next = {
        ...run,
        status: type === 'IntegrationRunPassed' ? 'passed' : 'failed',
        exitCode: toNumber(payload.exitCode),
        summary: normalize(payload.summary),
        completedAt: normalize(event.ts),
      };
      return withTask(
        state,
        taskId,
        {
          ...taskState,
          runs: {
            ...taskState.runs,
            [runId]: next,
          },
          latestRun: next,
        },
        event
      );
    }

    return state;
  }
}
