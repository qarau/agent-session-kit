function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTrainState(previous = {}, trainId = '') {
  return {
    trainId: normalize(previous.trainId) || normalize(trainId),
    title: normalize(previous.title),
    features: Array.isArray(previous.features) ? [...previous.features] : [],
    createdAt: normalize(previous.createdAt),
    updatedAt: normalize(previous.updatedAt),
    lastEventSeq: toNumber(previous.lastEventSeq),
    lastEventType: normalize(previous.lastEventType),
  };
}

function withTrain(state, trainId, trainState, event) {
  return {
    ...state,
    trains: {
      ...state.trains,
      [trainId]: {
        ...trainState,
        updatedAt: normalize(event.ts),
        lastEventSeq: toNumber(event.seq),
        lastEventType: normalize(event.type),
      },
    },
  };
}

export class ReleaseTrainProjector {
  initialState() {
    return { trains: {} };
  }

  apply(state, event) {
    const type = normalize(event.type);
    const payload = event.payload ?? {};

    if (type === 'ReleaseTrainCreated') {
      const trainId = normalize(payload.trainId);
      if (!trainId) {
        return state;
      }
      const current = createTrainState(state.trains?.[trainId], trainId);
      return withTrain(
        state,
        trainId,
        {
          ...current,
          title: normalize(payload.title),
          createdAt: current.createdAt || normalize(event.ts),
        },
        event
      );
    }

    if (type === 'ReleaseFeatureLinked') {
      const trainId = normalize(payload.trainId);
      const featureId = normalize(payload.featureId);
      if (!trainId || !featureId) {
        return state;
      }
      const current = createTrainState(state.trains?.[trainId], trainId);
      const features = new Set(current.features);
      features.add(featureId);
      return withTrain(
        state,
        trainId,
        {
          ...current,
          features: Array.from(features).sort(),
        },
        event
      );
    }

    return state;
  }
}
