function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTaskState(previous = {}) {
  return {
    latestDecision: previous.latestDecision ?? null,
    decisions: Array.isArray(previous.decisions) ? [...previous.decisions] : [],
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

export class PolicyPackProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalize(event.taskId);
    if (!taskId || normalize(event.type) !== 'PolicyDecisionRecorded') {
      return state;
    }

    const payload = event.payload ?? {};
    const decision = {
      queueClass: normalize(payload.queueClass).toLowerCase(),
      action: normalize(payload.action).toLowerCase(),
      skill: normalize(payload.skill),
      reason: normalize(payload.reason),
      packId: normalize(payload.packId),
      at: normalize(event.ts),
      seq: toNumber(event.seq),
    };

    const task = createTaskState(state.tasks?.[taskId]);
    const decisions = [...task.decisions, decision];

    return withTask(
      state,
      taskId,
      {
        ...task,
        latestDecision: decision,
        decisions,
      },
      event
    );
  }
}
