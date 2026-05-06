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

function deriveStatus(eventType) {
  if (eventType === 'SubagentDispatchRequested') {
    return 'requested';
  }
  if (eventType === 'SubagentDispatchStarted') {
    return 'started';
  }
  if (eventType === 'SubagentDispatchRetryScheduled') {
    return 'retry-scheduled';
  }
  if (eventType === 'SubagentDispatchCompleted') {
    return 'completed';
  }
  if (eventType === 'SubagentDispatchFailed') {
    return 'failed';
  }
  return '';
}

export class SubagentDispatchProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalize(event.taskId);
    if (!taskId) {
      return state;
    }

    const eventType = normalize(event.type);
    const status = deriveStatus(eventType);
    if (!status) {
      return state;
    }

    const payload = event.payload ?? {};
    const taskState = createTaskState(state.tasks?.[taskId]);
    const record = {
      status,
      eventType,
      seq: toNumber(event.seq),
      at: normalize(event.ts),
      provider: normalize(payload.provider),
      agentId: normalize(payload.agentId),
      childSessionId: normalize(payload.childSessionId),
      scope: normalize(payload.scope),
      executionStatus: normalize(payload.status),
      exitCode: toNumber(payload.exitCode),
      verificationOutcome: normalize(payload.verificationOutcome),
      artifactPath: normalize(payload.artifactPath),
      errorCode: normalize(payload.errorCode),
      errorMessage: normalize(payload.errorMessage),
      queueClass: normalize(payload.queueClass),
      requiredCapability: normalize(payload.requiredCapability),
      timeoutMs: toNumber(payload.timeoutMs),
      attempt: toNumber(payload.attempt),
      nextAttempt: toNumber(payload.nextAttempt),
      maxAttempts: toNumber(payload.maxAttempts),
      attempts: toNumber(payload.attempts),
      idempotencyKey: normalize(payload.idempotencyKey),
      dispatchId: normalize(payload.dispatchId),
      resumed: Boolean(payload.resumed),
      redactionLevel: normalize(payload.redactionLevel),
    };
    const history = [...taskState.history, record];

    return withTask(
      state,
      taskId,
      {
        ...taskState,
        latest: record,
        history,
      },
      event
    );
  }
}
