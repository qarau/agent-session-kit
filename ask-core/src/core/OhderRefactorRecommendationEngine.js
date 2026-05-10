import crypto from 'node:crypto';

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

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(entry => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprintFor(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload), 'utf8').digest('hex');
}

function architectureScore(architect = {}) {
  return toNumber(architect?.architectureScore?.overallScore, 0);
}

function unique(values = []) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function normalizeTarget(target = null) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    return null;
  }
  const targetId = normalize(target.targetId);
  if (!targetId) {
    return null;
  }
  const normalized = {
    targetId,
    type: normalize(target.type) || 'unknown',
    path: normalize(target.path),
    title: normalize(target.title),
    reason: normalize(target.reason),
  };
  if (target.evidence && typeof target.evidence === 'object' && !Array.isArray(target.evidence)) {
    normalized.evidence = {
      score: toNumber(target.evidence.score, 0),
      changeCount: toNumber(target.evidence.changeCount, 0),
      pressureEntries: toNumber(target.evidence.pressureEntries, 0),
      relatedTasks: Array.isArray(target.evidence.relatedTasks)
        ? unique(target.evidence.relatedTasks).sort()
        : [],
    };
  }
  return normalized;
}

function normalizeTargetPortfolio(portfolio = []) {
  if (!Array.isArray(portfolio)) {
    return [];
  }
  return portfolio
    .map(item => ({
      rank: toNumber(item?.rank, 0),
      selected: item?.selected === true,
      targetId: normalize(item?.targetId),
      type: normalize(item?.type) || 'file',
      path: normalize(item?.path),
      title: normalize(item?.title),
      score: toNumber(item?.score, 0),
      confidence: normalizeLower(item?.confidence) || 'low',
      blastRadius: normalizeLower(item?.blastRadius) || 'low',
      freshness: normalizeLower(item?.freshness) || 'unknown',
      reasons: unique(item?.reasons),
      evidence: item?.evidence && typeof item.evidence === 'object' && !Array.isArray(item.evidence)
        ? {
          changeCount: toNumber(item.evidence.changeCount, 0),
          pressureEntries: toNumber(item.evidence.pressureEntries, 0),
          relatedTasks: Array.isArray(item.evidence.relatedTasks)
            ? unique(item.evidence.relatedTasks).sort()
            : [],
        }
        : {},
    }))
    .filter(item => item.rank > 0 && item.targetId)
    .sort((left, right) => left.rank - right.rank);
}

function normalizeSuppression(suppression = null, baseSignals = []) {
  if (!suppression || typeof suppression !== 'object' || Array.isArray(suppression)) {
    return {
      reason: 'no-new-refactor-target',
      baseSignals: unique(baseSignals).sort(),
    };
  }
  return {
    reason: normalize(suppression.reason) || 'no-new-refactor-target',
    baseSignals: unique([
      ...(Array.isArray(suppression.baseSignals) ? suppression.baseSignals : []),
      ...baseSignals,
    ]).sort(),
  };
}

function lawSignals(architect = {}) {
  if (!Array.isArray(architect.lawViolations)) {
    return [];
  }
  return architect.lawViolations
    .map(violation => {
      const id = normalize(violation?.id || violation?.law);
      if (!id) {
        return '';
      }
      const severity = normalize(violation?.severity);
      return severity ? `law.${id}:${severity}` : `law.${id}`;
    })
    .filter(Boolean);
}

function entropySignals(entropy = {}) {
  const signals = [];
  const trend = normalize(entropy.trend);
  const refactorPressure = normalize(entropy.refactorPressure);
  const couplingTrend = normalize(entropy.couplingTrend);
  const replayabilityTrend = normalize(entropy.replayabilityTrend);
  if (trend) {
    signals.push(`entropy.trend:${trend}`);
  }
  if (refactorPressure) {
    signals.push(`entropy.refactorPressure:${refactorPressure}`);
  }
  if (couplingTrend) {
    signals.push(`entropy.couplingTrend:${couplingTrend}`);
  }
  if (replayabilityTrend) {
    signals.push(`entropy.replayabilityTrend:${replayabilityTrend}`);
  }
  return signals;
}

function defaultAcceptanceCriteria(blocking) {
  const criteria = [
    'Entropy pressure is reduced or explicitly justified.',
    'OHDER architect validation remains non-blocking.',
    'All tests and ASK gates pass.',
  ];
  if (blocking) {
    criteria.unshift('Blocking architecture violation is repaired or explicitly exempted.');
  }
  return criteria;
}

function rankConfidence(current, next) {
  const ranks = {
    low: 1,
    medium: 2,
    high: 3,
  };
  return ranks[next] > ranks[current] ? next : current;
}

export class OhderRefactorRecommendationEngine {
  evaluate({ architect = {}, entropy = {}, refactorGovernance = {}, policy = {}, targetDiscovery = null } = {}) {
    const targetSignals = [];
    const reasons = [];
    const blocking = architect.blocking === true;
    const score = architectureScore(architect);
    const minimumScore = toNumber(policy?.ohder_refactor?.minimum_architecture_score, 70);
    const entropyPressure = normalizeLower(entropy.refactorPressure);
    const entropyTrend = normalizeLower(entropy.trend);
    const replayabilityRisk = normalizeLower(architect.replayabilityRisk);
    const discoveredTarget = normalizeTarget(targetDiscovery?.target);
    const targetPortfolio = normalizeTargetPortfolio(targetDiscovery?.portfolio);
    let requiresConcreteTarget = false;
    let confidence = 'low';
    let title = 'Reduce OHDER entropy pressure';
    let objective = 'Create a governed refactor slice that reduces architecture entropy.';

    if (blocking) {
      title = 'Resolve OHDER architecture block';
      objective = 'Create a governed refactor slice that repair blocking architecture governance violations.';
      confidence = 'high';
      targetSignals.push('architect.blocking:true', ...lawSignals(architect));
      reasons.push(normalize(architect.reason) || 'OHDER architect governance is blocking continuation');
    }

    if (refactorGovernance.required === true) {
      const severity = normalizeLower(refactorGovernance.severity);
      confidence = rankConfidence(confidence, severity === 'high' ? 'high' : 'medium');
      title = normalize(refactorGovernance?.hint?.title) || title;
      objective = normalize(refactorGovernance?.hint?.objective) || objective;
      targetSignals.push('refactorGovernance.required:true');
      reasons.push(normalize(refactorGovernance.reason) || 'refactor governance requires an architecture repair slice');
    }

    if (entropyPressure === 'high' || entropyTrend === 'regressing') {
      requiresConcreteTarget = blocking !== true && refactorGovernance.required !== true;
      const scoreOnlyPressure = entropyTrend !== 'regressing'
        && !blocking
        && replayabilityRisk !== 'high'
        && score > 0
        && score < minimumScore;
      confidence = scoreOnlyPressure ? rankConfidence(confidence, 'medium') : 'high';
      targetSignals.push(...entropySignals(entropy));
      reasons.push(entropyTrend === 'regressing'
        ? 'OHDER entropy trend is regressing.'
        : 'OHDER entropy refactor pressure is high.');
    } else if (entropyPressure === 'medium') {
      const lowPressure = toNumber(entropy.entropyScore, 0) < 0.2
        && replayabilityRisk !== 'medium'
        && replayabilityRisk !== 'high'
        && score >= minimumScore
        && refactorGovernance.required !== true;
      confidence = rankConfidence(confidence, lowPressure ? 'low' : 'medium');
      targetSignals.push(...entropySignals(entropy));
      reasons.push(lowPressure
        ? 'OHDER entropy refactor pressure is low.'
        : 'OHDER entropy refactor pressure is medium.');
    }

    if (score > 0 && score < minimumScore) {
      confidence = rankConfidence(confidence, 'medium');
      targetSignals.push(`architectureScore:${String(score)}`);
      reasons.push(`architecture score ${String(score)} is below minimum ${String(minimumScore)}`);
    }

    if (replayabilityRisk === 'high') {
      confidence = 'high';
      targetSignals.push('architect.replayabilityRisk:high');
      if (!reasons.some(reason => reason.toLowerCase().includes('replayability'))) {
        reasons.push('OHDER replayability risk is high.');
      }
    }

    const normalizedSignals = unique(targetSignals);
    if (normalizedSignals.length < 1) {
      return {
        recommendation: null,
        suppression: null,
      };
    }

    if (requiresConcreteTarget && targetDiscovery && !discoveredTarget) {
      return {
        recommendation: null,
        suppression: normalizeSuppression(targetDiscovery?.suppression, normalizedSignals),
      };
    }

    const recommendation = {
      title,
      objective,
      reason: unique(reasons).join(' '),
      confidence,
      targetSignals: normalizedSignals.sort(),
      acceptanceCriteria: defaultAcceptanceCriteria(blocking),
      blocking,
    };
    if (discoveredTarget) {
      recommendation.target = discoveredTarget;
      recommendation.acceptanceCriteria = [
        `Targeted refactor scope is ${discoveredTarget.targetId}.`,
        ...recommendation.acceptanceCriteria,
      ];
    }
    if (targetPortfolio.length > 0) {
      recommendation.targetPortfolio = targetPortfolio;
    }

    return {
      recommendation: {
        fingerprint: fingerprintFor(recommendation),
        ...recommendation,
      },
      suppression: null,
    };
  }

  recommend(input = {}) {
    return this.evaluate(input).recommendation;
  }
}

