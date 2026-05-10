function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

export class FindingMetricsEngine {
  update(metrics = {}, { analyzerId = '', decision = '' } = {}) {
    const resolvedAnalyzerId = normalize(analyzerId) || 'unknown';
    const analyzers = {
      ...(metrics.analyzers || {}),
    };
    const current = analyzers[resolvedAnalyzerId] || {
      findings: 0,
      falsePositives: 0,
      falsePositiveRate: 0,
      lastUpdated: '',
    };
    const findings = toNumber(current.findings, 0);
    const falsePositives = toNumber(current.falsePositives, 0)
      + (normalize(decision) === 'false-positive' ? 1 : 0);
    analyzers[resolvedAnalyzerId] = {
      findings,
      falsePositives,
      falsePositiveRate: findings > 0 ? Number((falsePositives / findings).toFixed(4)) : 0,
      lastUpdated: nowIso(),
    };
    return {
      version: 1,
      updatedAt: nowIso(),
      analyzers,
    };
  }

  fromFindings(findings = []) {
    const analyzers = {};
    for (const finding of Array.isArray(findings) ? findings : []) {
      const analyzerId = normalize(finding?.analyzerId) || 'unknown';
      const current = analyzers[analyzerId] || {
        findings: 0,
        falsePositives: 0,
        falsePositiveRate: 0,
        lastUpdated: '',
      };
      current.findings += 1;
      if (normalize(finding?.resolution?.decision) === 'false-positive') {
        current.falsePositives += 1;
      }
      current.falsePositiveRate = current.findings > 0
        ? Number((current.falsePositives / current.findings).toFixed(4))
        : 0;
      current.lastUpdated = nowIso();
      analyzers[analyzerId] = current;
    }
    return {
      version: 1,
      updatedAt: nowIso(),
      analyzers,
    };
  }
}
