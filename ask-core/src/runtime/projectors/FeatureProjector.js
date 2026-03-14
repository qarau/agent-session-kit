function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createFeatureState(previous = {}, featureId = '') {
  return {
    featureId: normalize(previous.featureId) || normalize(featureId),
    title: normalize(previous.title),
    tasks: Array.isArray(previous.tasks) ? [...previous.tasks] : [],
    createdAt: normalize(previous.createdAt),
    updatedAt: normalize(previous.updatedAt),
    lastEventSeq: toNumber(previous.lastEventSeq),
    lastEventType: normalize(previous.lastEventType),
  };
}

function withFeature(state, featureId, featureState, event) {
  return {
    ...state,
    features: {
      ...state.features,
      [featureId]: {
        ...featureState,
        updatedAt: normalize(event.ts),
        lastEventSeq: toNumber(event.seq),
        lastEventType: normalize(event.type),
      },
    },
  };
}

export class FeatureProjector {
  initialState() {
    return { features: {} };
  }

  apply(state, event) {
    const type = normalize(event.type);
    const payload = event.payload ?? {};

    if (type === 'FeatureCreated') {
      const featureId = normalize(payload.featureId);
      if (!featureId) {
        return state;
      }
      const current = createFeatureState(state.features?.[featureId], featureId);
      return withFeature(
        state,
        featureId,
        {
          ...current,
          title: normalize(payload.title),
          createdAt: current.createdAt || normalize(event.ts),
        },
        event
      );
    }

    if (type === 'FeatureTaskLinked') {
      const featureId = normalize(payload.featureId);
      const taskId = normalize(payload.taskId);
      if (!featureId || !taskId) {
        return state;
      }
      const current = createFeatureState(state.features?.[featureId], featureId);
      const tasks = new Set(current.tasks);
      tasks.add(taskId);
      return withFeature(
        state,
        featureId,
        {
          ...current,
          tasks: Array.from(tasks).sort(),
        },
        event
      );
    }

    return state;
  }
}
