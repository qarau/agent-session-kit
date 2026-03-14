function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function list(value) {
  if (Array.isArray(value)) {
    return value.map(entry => normalize(entry)).filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function createAgentState(previous = {}, agentId = '') {
  return {
    agentId: normalize(previous.agentId) || normalize(agentId),
    capabilities: list(previous.capabilities),
    childSessions: list(previous.childSessions),
    updatedAt: normalize(previous.updatedAt),
    lastEventSeq: toNumber(previous.lastEventSeq),
    lastEventType: normalize(previous.lastEventType),
  };
}

function withAgent(state, agentId, agentState, event) {
  return {
    ...state,
    agents: {
      ...state.agents,
      [agentId]: {
        ...agentState,
        updatedAt: normalize(event.ts),
        lastEventSeq: toNumber(event.seq),
        lastEventType: normalize(event.type),
      },
    },
  };
}

export class AgentProjector {
  initialState() {
    return { agents: {} };
  }

  apply(state, event) {
    const type = normalize(event.type);
    const payload = event.payload ?? {};

    if (type === 'AgentRegistered') {
      const agentId = normalize(payload.agentId);
      if (!agentId) {
        return state;
      }
      const current = createAgentState(state.agents?.[agentId], agentId);
      return withAgent(
        state,
        agentId,
        {
          ...current,
          capabilities: list(payload.capabilities),
        },
        event
      );
    }

    if (type === 'ChildSessionCreated') {
      const agentId = normalize(payload.agentId);
      const childSessionId = normalize(payload.childSessionId);
      if (!agentId || !childSessionId) {
        return state;
      }
      const current = createAgentState(state.agents?.[agentId], agentId);
      const childSessions = new Set(current.childSessions);
      childSessions.add(childSessionId);
      return withAgent(
        state,
        agentId,
        {
          ...current,
          childSessions: Array.from(childSessions).sort(),
        },
        event
      );
    }

    return state;
  }
}
