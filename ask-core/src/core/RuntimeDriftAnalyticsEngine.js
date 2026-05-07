function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function pickWindow(history = [], windowSize = 10) {
  const size = Math.max(1, Math.floor(toNumber(windowSize, 10)));
  if (history.length <= size) {
    return [...history];
  }
  return history.slice(history.length - size);
}

function numericTrend(values = [], epsilon = 0.02) {
  if (values.length < 2) {
    return 'stable';
  }
  const first = toNumber(values[0], 0);
  const last = toNumber(values[values.length - 1], 0);
  const delta = last - first;
  if (Math.abs(delta) <= epsilon) {
    return 'stable';
  }
  return delta > 0 ? 'increasing' : 'decreasing';
}

function replayabilityRiskToScore(risk) {
  const normalized = normalize(risk);
  if (normalized === 'high') {
    return 1;
  }
  if (normalized === 'medium') {
    return 0.5;
  }
  if (normalized === 'low') {
    return 0;
  }
  return 0.5;
}

function trendToNumeric(trend) {
  const normalized = normalize(trend);
  if (normalized === 'increasing') {
    return 1;
  }
  if (normalized === 'decreasing') {
    return -1;
  }
  return 0;
}

function overallTrend(archScore, behaviorScore) {
  const combined = (toNumber(archScore, 0) + toNumber(behaviorScore, 0)) / 2;
  if (combined > 0.15) {
    return 'regressing';
  }
  if (combined < -0.15) {
    return 'improving';
  }
  return 'stable';
}

export class RuntimeDriftAnalyticsEngine {
  compute(history = [], options = {}) {
    const windowSize = Math.max(1, Math.floor(toNumber(options.windowSize, 10)));
    const window = pickWindow(history, windowSize);
    if (window.length < 1) {
      return {
        windowSize: 0,
        architecture: {
          entropyTrend: 'stable',
          couplingTrend: 'stable',
          replayabilityTrend: 'stable',
          driftScore: 0,
        },
        behavior: {
          replayConfidenceTrend: 'stable',
          protectedViolationTrend: 'stable',
          hardViolationTrend: 'stable',
          driftScore: 0,
        },
        overall: {
          trend: 'stable',
          driftScore: 0,
        },
        updatedAt: nowIso(),
      };
    }

    const entropyTrend = numericTrend(window.map(item => toNumber(item.entropyDelta, 0)));
    const couplingTrend = numericTrend(window.map(item => toNumber(item.couplingDelta, 0)));
    const replayabilityTrend = numericTrend(window.map(item => replayabilityRiskToScore(item.replayabilityRisk)));
    const replayConfidenceTrend = numericTrend(window.map(item => toNumber(item.behaviorReplayConfidence, 1)));
    const protectedViolationTrend = numericTrend(window.map(item => toNumber(item.protectedFlowViolations, 0)));
    const hardViolationTrend = numericTrend(window.map(item => toNumber(item.hardFlowViolations, 0)));

    const architectureDriftScore = Number(((
      trendToNumeric(entropyTrend)
      + trendToNumeric(couplingTrend)
      + trendToNumeric(replayabilityTrend)
    ) / 3).toFixed(4));
    const behaviorDriftScore = Number(((
      (-1 * trendToNumeric(replayConfidenceTrend))
      + trendToNumeric(protectedViolationTrend)
      + trendToNumeric(hardViolationTrend)
    ) / 3).toFixed(4));
    const totalDriftScore = Number((((architectureDriftScore + behaviorDriftScore) / 2)).toFixed(4));

    return {
      windowSize: window.length,
      architecture: {
        entropyTrend,
        couplingTrend,
        replayabilityTrend,
        driftScore: architectureDriftScore,
      },
      behavior: {
        replayConfidenceTrend,
        protectedViolationTrend,
        hardViolationTrend,
        driftScore: behaviorDriftScore,
      },
      overall: {
        trend: overallTrend(architectureDriftScore, behaviorDriftScore),
        driftScore: totalDriftScore,
      },
      updatedAt: nowIso(),
    };
  }
}
