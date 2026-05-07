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
  recommend({ architect = {}, entropy = {}, refactorGovernance = {}, policy = {} } = {}) {
    const targetSignals = [];
    const reasons = [];
    const blocking = architect.blocking === true;
    const score = architectureScore(architect);
    const minimumScore = toNumber(policy?.ohder_refactor?.minimum_architecture_score, 70);
    const entropyPressure = normalizeLower(entropy.refactorPressure);
    const entropyTrend = normalizeLower(entropy.trend);
    const replayabilityRisk = normalizeLower(architect.replayabilityRisk);
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
      confidence = 'high';
      targetSignals.push(...entropySignals(entropy));
      reasons.push(entropyTrend === 'regressing'
        ? 'OHDER entropy trend is regressing.'
        : 'OHDER entropy refactor pressure is high.');
    } else if (entropyPressure === 'medium') {
      confidence = rankConfidence(confidence, 'medium');
      targetSignals.push(...entropySignals(entropy));
      reasons.push('OHDER entropy refactor pressure is medium.');
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
      return null;
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

    return {
      fingerprint: fingerprintFor(recommendation),
      ...recommendation,
    };
  }
}
