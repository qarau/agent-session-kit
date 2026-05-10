function cloneObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : null;
}

export function createdRefactorGovernance(origin = null, previous = null) {
  if (!origin || typeof origin !== 'object' || origin.type !== 'ohder-refactor-governance') {
    return previous;
  }
  const baseline = cloneObject(origin.refactorBaseline);
  const next = {
    recommendationFingerprint: String(origin.recommendationFingerprint ?? ''),
    targetId: String(origin.targetId ?? ''),
    confidence: String(origin.confidence ?? ''),
    approvalRequired: origin.approvalRequired === true,
    approvalStatus: origin.approvalRequired === true ? 'pending' : 'not-required',
    approvedBy: '',
    rejectedReason: '',
    executionPlan: cloneObject(origin.refactorExecutionPlan),
  };
  if (baseline) {
    next.baseline = baseline;
  }
  return next;
}

export function approvedRefactorGovernance(previous = null, event = {}) {
  return {
    ...(previous ?? {}),
    approvalStatus: 'approved',
    approvalRequired: false,
    approvedBy: String(event.payload?.approvedBy ?? ''),
    approvedAt: String(event.ts ?? ''),
  };
}

export function rejectedRefactorGovernance(previous = null, event = {}) {
  return {
    ...(previous ?? {}),
    approvalStatus: 'rejected',
    rejectedReason: String(event.payload?.reason ?? ''),
    rejectedAt: String(event.ts ?? ''),
  };
}
