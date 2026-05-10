export function normalizeSliceCloseValue(value) {
  return String(value ?? '').trim();
}

export function toSliceCloseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalizeSliceCloseValue(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function toSliceCloseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSliceCloseLower(value) {
  return normalizeSliceCloseValue(value).toLowerCase();
}

export function parseSliceCloseList(value, fallback = [], lower = true) {
  const normalizeEntry = (entry) => {
    const resolved = normalizeSliceCloseValue(entry);
    return lower ? resolved.toLowerCase() : resolved;
  };
  if (Array.isArray(value)) {
    return value.map(entry => normalizeEntry(entry)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(entry => normalizeEntry(entry)).filter(Boolean);
  }
  return [...fallback].map(entry => normalizeEntry(entry)).filter(Boolean);
}

export function riskFromArchitectureScore(score) {
  const value = toSliceCloseNumber(score, 100);
  if (value < 70) {
    return 'high';
  }
  if (value < 85) {
    return 'medium';
  }
  return 'low';
}

export function entropyDimensionsFromArchitectResult(architect = {}) {
  const facts = architect?.ohderFacts && typeof architect.ohderFacts === 'object'
    ? architect.ohderFacts
    : {};
  const observabilityScore = architect?.architectureScore?.categories?.observability;
  return {
    ssotViolationCount: normalizeSliceCloseLower(facts.ssot_integrity) === 'invalid' ? 1 : 0,
    durabilityRisk: normalizeSliceCloseLower(architect?.durabilityAnalysis?.risk)
      || (normalizeSliceCloseLower(facts.durability_integrity) === 'at-risk' ? 'high' : 'low'),
    complexityRisk: normalizeSliceCloseLower(architect?.complexityAnalysis?.risk)
      || (normalizeSliceCloseLower(facts.srp_integrity) === 'weak' ? 'high' : 'low'),
    duplicationRisk: normalizeSliceCloseLower(architect?.duplicationAnalysis?.risk) || 'low',
    observabilityRisk: normalizeSliceCloseLower(architect?.observabilityAnalysis?.risk) || riskFromArchitectureScore(observabilityScore),
    refactorHealth: normalizeSliceCloseLower(architect?.refactorOutcome?.status) || 'healthy',
  };
}

export function parseGitStatusPath(line) {
  const raw = String(line ?? '').trimEnd();
  if (!raw) {
    return '';
  }
  const pathStart = raw.length > 2 && raw[2] === ' ' ? 3 : 2;
  return raw.slice(pathStart).trim();
}

export function resolveSliceCloseSummary({ taskId, lanes = [], fullSuiteResult = {} }) {
  const resolvedTaskId = normalizeSliceCloseValue(taskId);
  const laneText = lanes.length > 0 ? lanes.map(lane => normalizeSliceCloseValue(lane)).filter(Boolean).join(',') : 'default';
  if (fullSuiteResult.required) {
    return `slice close auto-verified after full suite pass for ${resolvedTaskId}; lanes=${laneText}; command=${normalizeSliceCloseValue(fullSuiteResult.command)}`;
  }
  return `slice close auto-verified for ${resolvedTaskId}; lanes=${laneText}; full-suite=not-required`;
}

export function isRefactorGovernedSliceTask(task = {}) {
  const taskId = normalizeSliceCloseLower(task?.taskId || task?.id);
  const title = normalizeSliceCloseLower(task?.title);
  return Boolean(task?.refactorGovernance)
    || normalizeSliceCloseValue(task?.origin?.type) === 'ohder-refactor-governance'
    || taskId.includes('refactor')
    || title.includes('refactor');
}
