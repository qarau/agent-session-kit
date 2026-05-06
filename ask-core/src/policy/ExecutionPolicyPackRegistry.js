function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

const PACKS = {
  planner: {
    action: 'dispatch',
    skill: 'writing-plans',
    reason: 'planning required',
    providerAllowlist: ['codex', 'codex-bridge'],
    allowedOverrides: ['claim', 'capability'],
    redactionLevel: 'standard',
    overrideApprovalRequired: false,
  },
  implementer: {
    action: 'dispatch',
    skill: 'executing-plans',
    reason: 'implementation in progress',
    providerAllowlist: ['codex', 'codex-bridge'],
    allowedOverrides: ['claim', 'capability'],
    redactionLevel: 'standard',
    overrideApprovalRequired: false,
  },
  verifier: {
    action: 'dispatch',
    skill: 'verification-before-completion',
    reason: 'verification not complete',
    providerAllowlist: ['codex', 'codex-bridge'],
    allowedOverrides: ['claim', 'capability'],
    redactionLevel: 'standard',
    overrideApprovalRequired: false,
  },
  debugger: {
    action: 'dispatch',
    skill: 'systematic-debugging',
    reason: 'verification failed',
    providerAllowlist: ['codex', 'codex-bridge'],
    allowedOverrides: ['claim', 'capability'],
    redactionLevel: 'standard',
    overrideApprovalRequired: false,
  },
  integrator: {
    action: 'dispatch',
    skill: 'finishing-a-development-branch',
    reason: 'integration required before merge',
    providerAllowlist: ['codex-bridge'],
    allowedOverrides: ['claim', 'capability', 'promotion'],
    redactionLevel: 'strict',
    overrideApprovalRequired: true,
  },
  reviewer: {
    action: 'hold',
    skill: 'finishing-a-development-branch',
    reason: 'manual review required before release',
    providerAllowlist: ['codex-bridge'],
    allowedOverrides: ['policy'],
    redactionLevel: 'strict',
    overrideApprovalRequired: true,
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
      providerAllowlist: Array.isArray(base.providerAllowlist) ? [...base.providerAllowlist] : [],
      allowedOverrides: Array.isArray(base.allowedOverrides) ? [...base.allowedOverrides] : [],
      redactionLevel: normalize(base.redactionLevel) || 'standard',
      overrideApprovalRequired: Boolean(base.overrideApprovalRequired),
    };
  }
}
