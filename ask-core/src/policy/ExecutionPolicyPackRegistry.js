function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

const PACKS = {
  planner: {
    action: 'dispatch',
    skill: 'writing-plans',
    reason: 'planning required',
  },
  implementer: {
    action: 'dispatch',
    skill: 'executing-plans',
    reason: 'implementation in progress',
  },
  verifier: {
    action: 'dispatch',
    skill: 'verification-before-completion',
    reason: 'verification not complete',
  },
  debugger: {
    action: 'dispatch',
    skill: 'systematic-debugging',
    reason: 'verification failed',
  },
  integrator: {
    action: 'dispatch',
    skill: 'finishing-a-development-branch',
    reason: 'integration required before merge',
  },
  reviewer: {
    action: 'hold',
    skill: 'finishing-a-development-branch',
    reason: 'manual review required before release',
  },
};

export class ExecutionPolicyPackRegistry {
  resolve(queueClass) {
    const key = normalize(queueClass);
    const base = PACKS[key] ?? PACKS.reviewer;
    return {
      queueClass: key || 'reviewer',
      action: base.action,
      skill: base.skill,
      reason: base.reason,
      packId: `default:${key || 'reviewer'}`,
    };
  }
}
