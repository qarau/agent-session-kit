function normalize(value) {
  return String(value ?? '').trim();
}

function modeBehavior(mode) {
  const normalized = normalize(mode).toLowerCase();
  if (normalized === 'strict') {
    return 'strict mode blocks hard-law OHDER violations and treats analyzer guardrail failures as close blockers';
  }
  if (normalized === 'refactor') {
    return 'refactor mode validates refactor outcomes against baseline entropy and architecture score before close';
  }
  return 'fast mode surfaces OHDER warnings quickly while preserving warning-first development flow';
}

function findingValues(state = {}) {
  return Object.values(state.ohderFindings?.findings || {});
}

function compactFinding(finding = {}) {
  return {
    id: normalize(finding.id),
    status: normalize(finding.status),
    severity: normalize(finding.severity),
    confidence: normalize(finding.confidence),
    metric: normalize(finding.metric),
    analyzerId: normalize(finding.analyzerId),
    lawId: normalize(finding.lawId),
    blocking: finding.blocking === true,
    resolution: finding.resolution || null,
  };
}

function unresolvedBlockingFindingValues(findings = []) {
  return findings
    .filter(finding => finding.blocking === true)
    .filter(finding => !['suppressed', 'resolved', 'exempted', 'accepted-risk'].includes(normalize(finding.status).toLowerCase()));
}

function recommendedActions({ decision = {}, loop = {}, findings = [] } = {}) {
  const actions = [];
  if (normalize(decision.recommendedCommand)) {
    actions.push(normalize(decision.recommendedCommand));
  }
  if (normalize(loop.next?.recommendedCommand)) {
    actions.push(normalize(loop.next.recommendedCommand));
  }
  if (unresolvedBlockingFindingValues(findings).length > 0) {
    actions.push('ask architect finding list');
  }
  actions.push('ask next');
  return [...new Set(actions.filter(Boolean))];
}

export function explainGovernanceDecision(state = {}) {
  const decision = state.governanceDecision || {};
  const loop = state.loop || {};
  const findings = findingValues(state);
  const reasons = [];
  if (normalize(decision.reason)) {
    reasons.push(normalize(decision.reason));
  }
  if (normalize(loop.completion?.reason)) {
    reasons.push(normalize(loop.completion.reason));
  }
  const steps = Array.isArray(loop.history) ? loop.history : [];
  const compactSteps = steps.map(step => ({
    index: step.index,
    name: step.name,
    details: step.details || {},
  }));
  return {
    decision: normalize(decision.decision || loop.decision || 'unknown'),
    blocking: decision.blocking === true || normalize(loop.decision) === 'block',
    reasons: [...new Set(reasons)],
    loopId: normalize(loop.loopId),
    loopStatus: normalize(loop.status),
    ohderMode: normalize(state.ohderMode || state.architect?.ohderMode || 'fast'),
    modeBehavior: modeBehavior(state.ohderMode || state.architect?.ohderMode),
    unresolvedBlockingFindings: unresolvedBlockingFindingValues(findings).map(compactFinding),
    acceptedRisks: findings
      .filter(finding => normalize(finding.status).toLowerCase() === 'accepted-risk')
      .map(compactFinding),
    temporaryExemptions: findings
      .filter(finding => normalize(finding.status).toLowerCase() === 'exempted')
      .map(compactFinding),
    recentSuppressions: findings
      .filter(finding => normalize(finding.status).toLowerCase() === 'suppressed')
      .map(compactFinding),
    lawTuningRequests: findings
      .filter(finding => normalize(finding.resolution?.decision).toLowerCase() === 'tune-law')
      .map(compactFinding),
    analyzerTuningRequests: findings
      .filter(finding => normalize(finding.resolution?.decision).toLowerCase() === 'tune-analyzer')
      .map(compactFinding),
    analyzerHealthWarnings: [],
    recommendedActions: recommendedActions({ decision, loop, findings }),
    lastStep: compactSteps.length > 0 ? compactSteps[compactSteps.length - 1] : null,
    steps: compactSteps,
  };
}

export function buildGovernanceStatusReport(state = {}) {
  return {
    ok: true,
    sessionId: normalize(state.sessionId),
    runtimeStatus: normalize(state.status),
    nextRecommendedAction: normalize(state.nextRecommendedAction),
    ohderMode: normalize(state.ohderMode || state.architect?.ohderMode || 'fast'),
    continuityValid: state.continuityValid === true,
    dirtyWorktree: state.dirtyWorktree === true,
    architect: state.architect || {},
    flow: state.flow || {},
    loop: state.loop || {},
    governanceDecision: state.governanceDecision || {},
    ohderFindings: state.ohderFindings || { version: 1, findings: {} },
  };
}

export function buildGovernanceExplainReport(state = {}) {
  return {
    ok: true,
    sessionId: normalize(state.sessionId),
    ohderMode: normalize(state.ohderMode || state.architect?.ohderMode || 'fast'),
    explanation: explainGovernanceDecision(state),
  };
}
