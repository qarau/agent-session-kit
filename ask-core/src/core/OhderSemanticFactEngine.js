function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function unique(values = []) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function normalizeConfidence(value) {
  const normalized = normalizeLower(value);
  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized;
  }
  if (['critical', 'block', 'blocking'].includes(normalized)) {
    return 'high';
  }
  if (['warn', 'warning'].includes(normalized)) {
    return 'medium';
  }
  return 'low';
}

function normalizeSeverity(value) {
  const normalized = normalizeLower(value);
  return ['low', 'medium', 'high', 'critical'].includes(normalized) ? normalized : 'low';
}

function normalizeEvidence(evidence = []) {
  if (!Array.isArray(evidence)) {
    return [];
  }
  const seen = new Set();
  const normalized = [];
  for (const item of evidence) {
    const filePath = normalizePath(item?.filePath);
    const reason = normalize(item?.reason);
    const lineHint = normalize(item?.lineHint);
    if (!filePath && !reason && !lineHint) {
      continue;
    }
    const key = `${filePath}|${lineHint}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      ...(filePath ? { filePath } : {}),
      ...(reason ? { reason } : {}),
      ...(lineHint ? { lineHint } : {}),
    });
  }
  return normalized;
}

function factKey(fact = {}) {
  return normalize(fact.factId)
    || `${normalize(fact.metric)}:${normalize(fact.value)}:${normalize(fact.source)}`;
}

function confidenceForFact(value, fallback = 'low') {
  const normalized = normalizeLower(value);
  if (['invalid', 'at-risk', 'weak', 'high', 'failed', 'false'].includes(normalized)) {
    return 'high';
  }
  if (['medium', 'warning'].includes(normalized)) {
    return 'medium';
  }
  return normalizeConfidence(fallback);
}

function severityForFact(value) {
  const normalized = normalizeLower(value);
  if (['invalid', 'at-risk', 'high', 'failed', 'false'].includes(normalized)) {
    return 'critical';
  }
  if (normalized === 'weak') {
    return 'medium';
  }
  return 'low';
}

function evidenceFromFindings(findings = [], filePath = '') {
  return (Array.isArray(findings) ? findings : [])
    .map(finding => ({
      filePath,
      reason: normalize(finding),
    }))
    .filter(item => item.reason);
}

function evidenceFromSecurityAnalysis(securityAnalysis = {}) {
  const fromFiles = Array.isArray(securityAnalysis.filesAnalyzed)
    ? securityAnalysis.filesAnalyzed.flatMap(item => {
      const findings = Array.isArray(item.findings) ? item.findings : [];
      if (findings.length > 0) {
        return evidenceFromFindings(findings, item.filePath);
      }
      return item.filePath
        ? [{
          filePath: item.filePath,
          reason: Array.isArray(item.signals) && item.signals.length > 0
            ? `security signals: ${item.signals.join(', ')}`
            : 'security-sensitive change',
        }]
        : [];
    })
    : [];
  return fromFiles.length > 0
    ? fromFiles
    : evidenceFromFindings(securityAnalysis.findings);
}

export class OhderSemanticFactEngine {
  normalizeFacts(facts = []) {
    const result = [];
    const seen = new Set();
    for (const rawFact of Array.isArray(facts) ? facts : []) {
      const metric = normalize(rawFact?.metric);
      const value = normalize(rawFact?.value);
      if (!metric || !value) {
        continue;
      }
      const factId = factKey(rawFact);
      if (seen.has(factId)) {
        continue;
      }
      seen.add(factId);
      result.push({
        factId,
        metric,
        value,
        confidence: normalizeConfidence(rawFact?.confidence),
        severity: normalizeSeverity(rawFact?.severity),
        source: normalize(rawFact?.source) || 'unknown',
        evidence: normalizeEvidence(rawFact?.evidence),
        recommendations: unique(rawFact?.recommendations),
      });
    }
    return result;
  }

  fromArchitectContext({
    ohderFacts = {},
    authorityAnalysis = {},
    ssotAnalysis = {},
    eventOnlySyncAnalysis = {},
    duplicationAnalysis = {},
    observabilityAnalysis = {},
    testabilityAnalysis = {},
    couplingAnalysis = {},
    durabilityAnalysis = {},
    complexityAnalysis = {},
    securityAnalysis = {},
  } = {}) {
    return this.normalizeFacts([
      {
        factId: 'projection-authority',
        metric: 'projection_authority',
        value: ohderFacts.projection_authority,
        confidence: confidenceForFact(ohderFacts.projection_authority),
        severity: severityForFact(ohderFacts.projection_authority),
        source: 'OhderAuthorityAnalyzerEngine',
        evidence: Array.isArray(authorityAnalysis.violations)
          ? authorityAnalysis.violations.map(item => ({
            filePath: item.filePath,
            reason: item.reason || item.kind,
          }))
          : [],
        recommendations: authorityAnalysis.recommendations,
      },
      {
        factId: 'event-only-sync',
        metric: 'event_only_sync',
        value: ohderFacts.event_only_sync,
        confidence: confidenceForFact(ohderFacts.event_only_sync, eventOnlySyncAnalysis.risk),
        severity: severityForFact(ohderFacts.event_only_sync),
        source: 'OhderEventOnlySyncAnalyzerEngine',
        evidence: Array.isArray(eventOnlySyncAnalysis.violations)
          ? eventOnlySyncAnalysis.violations.map(item => ({
            filePath: item.filePath,
            reason: item.reason || item.kind,
          }))
          : [],
        recommendations: eventOnlySyncAnalysis.recommendations,
      },
      {
        factId: 'ssot-integrity',
        metric: 'ssot_integrity',
        value: ohderFacts.ssot_integrity,
        confidence: confidenceForFact(ohderFacts.ssot_integrity, ssotAnalysis.risk),
        severity: severityForFact(ohderFacts.ssot_integrity),
        source: 'OhderSsotAnalyzerEngine',
        evidence: Array.isArray(ssotAnalysis.violations)
          ? ssotAnalysis.violations.flatMap(item => item.writers.map(writer => ({
            filePath: writer.filePath,
            reason: item.reason,
            lineHint: item.target,
          })))
          : [],
        recommendations: ssotAnalysis.recommendations,
      },
      {
        factId: 'duplication-risk',
        metric: 'duplication_risk',
        value: ohderFacts.duplication_risk,
        confidence: confidenceForFact(ohderFacts.duplication_risk, duplicationAnalysis.risk),
        severity: severityForFact(ohderFacts.duplication_risk),
        source: 'OhderDuplicationAnalyzerEngine',
        evidence: Array.isArray(duplicationAnalysis.duplicateGroups)
          ? duplicationAnalysis.duplicateGroups.flatMap(item => item.occurrences.map(occurrence => ({
            filePath: occurrence.filePath,
            reason: 'duplicated logic',
            lineHint: `line ${String(occurrence.startLine)}`,
          })))
          : [],
        recommendations: duplicationAnalysis.recommendations,
      },
      {
        factId: 'observability-risk',
        metric: 'observability_risk',
        value: ohderFacts.observability_risk,
        confidence: confidenceForFact(ohderFacts.observability_risk, observabilityAnalysis.risk),
        severity: severityForFact(ohderFacts.observability_risk),
        source: 'OhderObservabilityAnalyzerEngine',
        evidence: Array.isArray(observabilityAnalysis.violations)
          ? observabilityAnalysis.violations.map(item => ({
            filePath: item.filePath,
            reason: item.reason || item.kind,
          }))
          : [],
        recommendations: observabilityAnalysis.recommendations,
      },
      {
        factId: 'testability-risk',
        metric: 'testability_risk',
        value: ohderFacts.testability_risk,
        confidence: confidenceForFact(ohderFacts.testability_risk, testabilityAnalysis.risk),
        severity: severityForFact(ohderFacts.testability_risk),
        source: 'OhderTestabilityAnalyzerEngine',
        evidence: Array.isArray(testabilityAnalysis.violations)
          ? testabilityAnalysis.violations.map(item => ({
            filePath: item.filePath,
            reason: item.reason || item.kind,
          }))
          : [],
        recommendations: testabilityAnalysis.recommendations,
      },
      {
        factId: 'security-boundary',
        metric: 'security_boundary',
        value: ohderFacts.security_boundary,
        confidence: confidenceForFact(ohderFacts.security_boundary, securityAnalysis.risk),
        severity: severityForFact(ohderFacts.security_boundary),
        source: 'OhderSecurityBoundaryAnalyzerEngine',
        evidence: evidenceFromSecurityAnalysis(securityAnalysis),
        recommendations: securityAnalysis.recommendations,
      },
      {
        factId: 'layer-isolation',
        metric: 'layer_isolation',
        value: ohderFacts.layer_isolation,
        confidence: confidenceForFact(ohderFacts.layer_isolation, couplingAnalysis.risk),
        severity: severityForFact(ohderFacts.layer_isolation),
        source: 'OhderCouplingAnalyzerEngine',
        evidence: Array.isArray(couplingAnalysis.crossLayerImports)
          ? couplingAnalysis.crossLayerImports.map(item => ({
            filePath: item.filePath,
            reason: item.reason,
            lineHint: item.import,
          }))
          : [],
        recommendations: couplingAnalysis.recommendations,
      },
      {
        factId: 'durability-integrity',
        metric: 'durability_integrity',
        value: ohderFacts.durability_integrity,
        confidence: confidenceForFact(ohderFacts.durability_integrity, durabilityAnalysis.risk),
        severity: severityForFact(ohderFacts.durability_integrity),
        source: 'OhderDurabilityValidatorEngine',
        evidence: Array.isArray(durabilityAnalysis.touchpoints)
          ? durabilityAnalysis.touchpoints.map(item => ({
            filePath: item.filePath,
            reason: item.finding || item.kind,
          }))
          : [],
        recommendations: durabilityAnalysis.recommendations,
      },
      {
        factId: 'srp-integrity',
        metric: 'srp_integrity',
        value: ohderFacts.srp_integrity,
        confidence: confidenceForFact(ohderFacts.srp_integrity, complexityAnalysis.risk),
        severity: severityForFact(ohderFacts.srp_integrity),
        source: 'OhderComplexityAnalyzerEngine',
        evidence: evidenceFromFindings(complexityAnalysis.findings),
        recommendations: complexityAnalysis.recommendations,
      },
    ]);
  }
}
