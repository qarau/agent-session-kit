import { FindingResolutionRuntime } from './FindingResolutionRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

export class GovernanceBypassFindingEngine {
  constructor(cwd) {
    this.findings = new FindingResolutionRuntime(cwd);
  }

  async report({
    sessionId = '',
    taskId = '',
    bypassType = 'governance-bypass',
    severity = 'critical',
    message = '',
    evidence = [],
    recommendations = [],
  } = {}) {
    const normalizedBypassType = normalize(bypassType) || 'governance-bypass';
    const normalizedMessage = normalize(message) || normalizedBypassType;
    const fact = {
      factId: `governance-bypass-${normalizedBypassType}`,
      metric: 'governance_bypass',
      value: 'invalid',
      confidence: 'high',
      severity: normalize(severity) || 'critical',
      source: 'GovernanceBypassFindingEngine',
      evidence: [{ reason: `${normalizedBypassType}: ${normalizedMessage}` }]
        .concat((Array.isArray(evidence) ? evidence : [])
          .map(item => ({
            filePath: normalizePath(item.filePath),
            reason: normalize(item.reason),
            lineHint: normalize(item.lineHint),
          }))
          .filter(item => item.filePath || item.reason || item.lineHint)),
      recommendations: Array.isArray(recommendations) && recommendations.length > 0
        ? recommendations.map(normalize).filter(Boolean)
        : ['Route the work through ASK plan handoff, active task start, and slice close provenance.'],
    };

    return this.findings.detectFromArchitect({
      sessionId,
      taskId,
      architect: {
        blocking: false,
        semanticFacts: [fact],
        lawViolations: [],
      },
    });
  }
}
