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
    currentStage: normalize(previous.currentStage),
    gates: previous.gates ? { ...previous.gates } : {},
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

export class PromotionGateProjector {
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

    if (type === 'PromotionGateRequired') {
      const gateId = normalize(payload.gateId);
      if (!gateId) {
        return state;
      }
      const currentGate = current.gates[gateId] ?? {};
      return withFeature(
        state,
        featureId,
        {
          ...current,
          gates: {
            ...current.gates,
            [gateId]: {
              gateId,
              status: 'required',
              requiredAt: normalize(event.ts),
              passedAt: normalize(currentGate.passedAt),
            },
          },
        },
        event
      );
    }

    if (type === 'PromotionGatePassed') {
      const gateId = normalize(payload.gateId);
      if (!gateId) {
        return state;
      }
      const currentGate = current.gates[gateId] ?? {
        gateId,
        status: 'required',
        requiredAt: '',
        passedAt: '',
      };
      return withFeature(
        state,
        featureId,
        {
          ...current,
          gates: {
            ...current.gates,
            [gateId]: {
              ...currentGate,
              gateId,
              status: 'passed',
              passedAt: normalize(event.ts),
            },
          },
        },
        event
      );
    }

    if (type === 'PromotionAdvanced') {
      const stage = normalize(payload.stage);
      if (!stage) {
        return state;
      }
      return withFeature(
        state,
        featureId,
        {
          ...current,
          currentStage: stage,
        },
        event
      );
    }

    return state;
  }
}
