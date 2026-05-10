function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function compactRefactorRecommendation(recommendation = null) {
  if (!recommendation || typeof recommendation !== 'object' || Array.isArray(recommendation)) {
    return null;
  }
  const compact = {
    fingerprint: normalize(recommendation.fingerprint),
    title: normalize(recommendation.title),
    confidence: normalize(recommendation.confidence),
    reason: normalize(recommendation.reason),
    targetSignals: Array.isArray(recommendation.targetSignals)
      ? recommendation.targetSignals.map(normalize).filter(Boolean)
      : [],
  };
  if (recommendation.target && typeof recommendation.target === 'object' && !Array.isArray(recommendation.target)) {
    compact.target = {
      targetId: normalize(recommendation.target.targetId),
      type: normalize(recommendation.target.type),
      path: normalize(recommendation.target.path),
    };
  }
  return compact;
}

export function resolveRefactorCommand(recommendation = null, policy = {}) {
  const compact = compactRefactorRecommendation(recommendation);
  if (
    compact?.confidence === 'high'
    && (
      policy?.ohder_autonomy?.auto_create_refactor_tasks === true
      || policy?.refactor_materialization?.auto_materialize_high_confidence === true
    )
  ) {
    return 'ask refactor create --auto';
  }
  return 'ask refactor preview';
}

export function compactEntropy(entropy = null) {
  if (!entropy || typeof entropy !== 'object' || Array.isArray(entropy)) {
    return null;
  }
  return {
    entropyScore: toNumber(entropy.entropyScore, 0),
    trend: normalize(entropy.trend),
    couplingTrend: normalize(entropy.couplingTrend),
    replayabilityTrend: normalize(entropy.replayabilityTrend),
    architectureScoreDelta: toNumber(entropy.architectureScoreDelta, 0),
    refactorPressure: normalize(entropy.refactorPressure),
  };
}
