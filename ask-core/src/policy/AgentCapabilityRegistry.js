function normalize(value) {
  return String(value ?? '').trim();
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

export class AgentCapabilityRegistry {
  findAgent(requiredCapability, agents = {}, options = {}) {
    const required = normalize(requiredCapability);
    if (!required) {
      return null;
    }

    const map = agents && typeof agents === 'object' ? agents : {};
    const candidates = list(options.candidates);
    const ordered = candidates.length > 0 ? candidates : Object.keys(map).sort();

    for (const agentId of ordered) {
      const record = map[agentId];
      if (!record) {
        continue;
      }
      const capabilities = list(record.capabilities);
      if (capabilities.includes(required)) {
        return {
          agentId: normalize(agentId),
          capabilities,
        };
      }
    }

    return null;
  }
}
