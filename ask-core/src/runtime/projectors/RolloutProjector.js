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
    status: normalize(previous.status) || 'not-started',
    currentPhase: normalize(previous.currentPhase),
    rollback: previous.rollback ? { ...previous.rollback } : null,
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

export class RolloutProjector {
  initialState() {
    return { features: {} };
  }

  apply(state, event) {
    const type = normalize(event.type);
    const payload = event.payload ?? {};
    const featureId = normalize(payload.featureId);
    if (!featureId) {
      return state;
    }
    const current = createFeatureState(state.features?.[featureId], featureId);

    if (type === 'RolloutStarted') {
      return withFeature(
        state,
        featureId,
        {
          ...current,
          status: 'in-progress',
          currentPhase: normalize(payload.phase),
          rollback: null,
        },
        event
      );
    }

    if (type === 'RolloutPhaseSet') {
      return withFeature(
        state,
        featureId,
        {
          ...current,
          status: current.status === 'not-started' ? 'in-progress' : current.status,
          currentPhase: normalize(payload.phase),
        },
        event
      );
    }

    if (type === 'RollbackTriggered') {
      return withFeature(
        state,
        featureId,
        {
          ...current,
          status: 'rolled-back',
          rollback: {
            reason: normalize(payload.reason),
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
