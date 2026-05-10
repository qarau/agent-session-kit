export interface AskSliceCloseFullSuiteSummaryInput {
  required?: boolean;
  command?: string;
}

export interface AskSliceCloseSummaryInput {
  taskId: unknown;
  lanes?: unknown[];
  fullSuiteResult?: AskSliceCloseFullSuiteSummaryInput;
}

export interface AskSliceCloseArchitectLike {
  ohderFacts?: Record<string, unknown>;
  architectureScore?: {
    categories?: Record<string, unknown>;
  };
  durabilityAnalysis?: {
    risk?: unknown;
  };
  complexityAnalysis?: {
    risk?: unknown;
  };
  duplicationAnalysis?: {
    risk?: unknown;
  };
  observabilityAnalysis?: {
    risk?: unknown;
  };
  refactorOutcome?: {
    status?: unknown;
  };
}

export interface AskSliceCloseEntropyDimensions {
  ssotViolationCount: number;
  durabilityRisk: string;
  complexityRisk: string;
  duplicationRisk: string;
  observabilityRisk: string;
  refactorHealth: string;
}

export function normalizeSliceCloseValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function toSliceCloseBoolean(value: unknown, fallback = false): boolean {
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

export function toSliceCloseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeSliceCloseLower(value: unknown): string {
  return normalizeSliceCloseValue(value).toLowerCase();
}

export function parseSliceCloseList(value: unknown, fallback: unknown[] = [], lower = true): string[] {
  const normalizeEntry = (entry: unknown): string => {
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

export function riskFromArchitectureScore(score: unknown): 'low' | 'medium' | 'high' {
  const value = toSliceCloseNumber(score, 100);
  if (value < 70) {
    return 'high';
  }
  if (value < 85) {
    return 'medium';
  }
  return 'low';
}

export function entropyDimensionsFromArchitectResult(
  architect: AskSliceCloseArchitectLike = {}
): AskSliceCloseEntropyDimensions {
  const facts = architect.ohderFacts && typeof architect.ohderFacts === 'object'
    ? architect.ohderFacts
    : {};
  const observabilityScore = architect.architectureScore?.categories?.observability;
  return {
    ssotViolationCount: normalizeSliceCloseLower(facts.ssot_integrity) === 'invalid' ? 1 : 0,
    durabilityRisk: normalizeSliceCloseLower(architect.durabilityAnalysis?.risk)
      || (normalizeSliceCloseLower(facts.durability_integrity) === 'at-risk' ? 'high' : 'low'),
    complexityRisk: normalizeSliceCloseLower(architect.complexityAnalysis?.risk)
      || (normalizeSliceCloseLower(facts.srp_integrity) === 'weak' ? 'high' : 'low'),
    duplicationRisk: normalizeSliceCloseLower(architect.duplicationAnalysis?.risk) || 'low',
    observabilityRisk: normalizeSliceCloseLower(architect.observabilityAnalysis?.risk) || riskFromArchitectureScore(observabilityScore),
    refactorHealth: normalizeSliceCloseLower(architect.refactorOutcome?.status) || 'healthy',
  };
}

export function parseGitStatusPath(line: unknown): string {
  const raw = String(line ?? '').trimEnd();
  if (!raw) {
    return '';
  }
  const pathStart = raw.length > 2 && raw[2] === ' ' ? 3 : 2;
  return raw.slice(pathStart).trim();
}

export function resolveSliceCloseSummary(input: AskSliceCloseSummaryInput): string {
  const taskId = normalizeSliceCloseValue(input.taskId);
  const lanes = Array.isArray(input.lanes) ? input.lanes.map(lane => normalizeSliceCloseValue(lane)).filter(Boolean) : [];
  const laneText = lanes.length > 0 ? lanes.join(',') : 'default';
  const fullSuiteResult = input.fullSuiteResult ?? {};
  if (fullSuiteResult.required) {
    return `slice close auto-verified after full suite pass for ${taskId}; lanes=${laneText}; command=${normalizeSliceCloseValue(fullSuiteResult.command)}`;
  }
  return `slice close auto-verified for ${taskId}; lanes=${laneText}; full-suite=not-required`;
}

export function isRefactorGovernedSliceTask(task: Record<string, unknown> = {}): boolean {
  const taskId = normalizeSliceCloseLower(task.taskId || task.id);
  const title = normalizeSliceCloseLower(task.title);
  const origin = task.origin && typeof task.origin === 'object' ? task.origin as Record<string, unknown> : {};
  return Boolean(task.refactorGovernance)
    || normalizeSliceCloseValue(origin.type) === 'ohder-refactor-governance'
    || taskId.includes('refactor')
    || title.includes('refactor');
}
