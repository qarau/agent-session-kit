function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(toNumber(value, 0).toFixed(4))));
}

function nowIso() {
  return new Date().toISOString();
}

function scoreOf(architect = {}) {
  return toNumber(architect?.architectureScore?.overallScore, 0);
}

function replayabilityPenalty(risk) {
  const normalized = normalizeLower(risk);
  if (normalized === 'high') {
    return 0.35;
  }
  if (normalized === 'medium') {
    return 0.16;
  }
  return 0;
}

function resolveTrend(driftAnalytics = {}) {
  return normalizeLower(driftAnalytics?.overall?.trend) || 'stable';
}

function resolveArchitectureTrend(driftAnalytics = {}, key, fallback = 'stable') {
  return normalizeLower(driftAnalytics?.architecture?.[key]) || fallback;
}

export class OhderEntropySnapshotEngine {
  snapshot({ architect = {}, previousArchitect = null, driftAnalytics = {}, policy = {} } = {}) {
    const architectureScore = scoreOf(architect);
    const previousScore = previousArchitect ? scoreOf(previousArchitect) : architectureScore;
    const architectureScoreDelta = Math.round(architectureScore - previousScore);
    const entropyDelta = toNumber(architect.entropyDelta, 0);
    const couplingDelta = toNumber(architect.couplingDelta, 0);
    const replayabilityRisk = normalizeLower(architect.replayabilityRisk) || 'unknown';
    const minimumScore = toNumber(policy?.ohder_entropy?.minimum_architecture_score, 70);
    const warningScoreDrop = Math.max(1, toNumber(policy?.ohder_entropy?.warning_score_drop, 5));

    const scorePenalty = architectureScore > 0
      ? Math.max(0, (100 - architectureScore) / 100)
      : 0.25;
    const entropyScore = clamp01(
      (entropyDelta * 0.08)
      + (couplingDelta * 0.08)
      + replayabilityPenalty(replayabilityRisk)
      + scorePenalty
    );
    const trend = resolveTrend(driftAnalytics);
    const couplingTrend = resolveArchitectureTrend(driftAnalytics, 'couplingTrend');
    const replayabilityTrend = resolveArchitectureTrend(driftAnalytics, 'replayabilityTrend');
    const blocking = architect.blocking === true;

    let refactorPressure = 'none';
    if (
      blocking
      || trend === 'regressing'
      || replayabilityRisk === 'high'
      || (architectureScore > 0 && architectureScore < minimumScore)
    ) {
      refactorPressure = 'high';
    } else if (
      normalizeLower(architect.status) === 'warning'
      || replayabilityRisk === 'medium'
      || architectureScoreDelta <= -warningScoreDrop
      || entropyScore >= 0.25
    ) {
      refactorPressure = 'medium';
    }

    return {
      entropyScore,
      trend,
      couplingTrend,
      replayabilityTrend,
      architectureScore,
      architectureScoreDelta,
      refactorPressure,
      blocking,
      entropyDelta,
      couplingDelta,
      replayabilityRisk,
      measuredAt: nowIso(),
    };
  }
}
