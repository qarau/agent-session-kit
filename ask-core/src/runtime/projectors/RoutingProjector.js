function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTaskState(previous = {}) {
  return {
    latestRecommendation: previous.latestRecommendation ?? null,
    recommendations: previous.recommendations ? [...previous.recommendations] : [],
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

export class RoutingProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalize(event.taskId);
    if (!taskId) {
      return state;
    }

    if (normalize(event.type) !== 'RouteRecommended') {
      return state;
    }

    const payload = event.payload ?? {};
    const recommendation = {
      agentId: normalize(payload.agentId),
      requiredCapability: normalize(payload.requiredCapability),
      policy: normalize(payload.policy),
      reason: normalize(payload.reason),
      at: normalize(event.ts),
      seq: toNumber(event.seq),
    };

    const taskState = createTaskState(state.tasks?.[taskId]);
    const recommendations = [...taskState.recommendations, recommendation];

    return withTask(
      state,
      taskId,
      {
        ...taskState,
        latestRecommendation: recommendation,
        recommendations,
      },
      event
    );
  }
}
