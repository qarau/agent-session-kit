import { compactEntropy, compactRefactorRecommendation, resolveRefactorCommand } from './OhderRuntimeSummaries.js';

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

function hasEntries(value) {
  return Array.isArray(value) && value.length > 0;
}

function architectureScore(architect = {}) {
  return toNumber(architect?.architectureScore?.overallScore, 0);
}

function baseDecision(action, reason, architect = {}, patch = {}) {
  return {
    type: 'ohder-action',
    action,
    reason,
    blocking: false,
    source: 'ohder-next-action',
    architectStatus: normalize(architect.status) || 'unknown',
    architectureScore: architectureScore(architect),
    recommendedCommand: '',
    ...patch,
  };
}

export class OhderNextActionEngine {
  decide({ state = {}, architect = {}, refactorGovernance = {}, entropy = null, refactorRecommendation = null, refactorSuppression = null, tasks = {}, policy = {} } = {}) {
    if (hasEntries(tasks.active) || hasEntries(tasks.ready)) {
      return null;
    }

    if (architect.blocking === true) {
      return baseDecision(
        'resolve-architecture-block',
        normalize(architect.reason) || 'OHDER architect governance is blocking continuation',
        architect,
        {
          blocking: true,
          recommendedCommand: 'ask architect status',
        }
      );
    }

    if (refactorGovernance.required === true) {
      return baseDecision(
        'create-refactor-slice',
        normalize(refactorGovernance.reason) || 'refactor governance requires an architecture repair slice',
        architect,
        {
          recommendedCommand: resolveRefactorCommand(refactorRecommendation, policy),
          refactorRecommendation: compactRefactorRecommendation(refactorRecommendation),
        }
      );
    }

    const entropyPressure = normalizeLower(entropy?.refactorPressure);
    const entropyTrend = normalizeLower(entropy?.trend);
    if (entropyPressure === 'high' || entropyTrend === 'regressing') {
      if (!refactorRecommendation && normalizeLower(refactorSuppression?.reason) === 'no-new-refactor-target') {
        return baseDecision(
          'run-governance-validation',
          'OHDER entropy is regressing but no new concrete refactor target was found',
          architect,
          {
            entropy: compactEntropy(entropy),
            recommendedCommand: 'ask governance status',
            refactorSuppression: {
              reason: normalize(refactorSuppression.reason),
              baseSignals: Array.isArray(refactorSuppression.baseSignals)
                ? refactorSuppression.baseSignals.map(normalize).filter(Boolean)
                : [],
            },
          }
        );
      }
      const reason = entropyTrend === 'regressing'
        ? 'OHDER entropy trend is regressing'
        : 'OHDER entropy refactor pressure is high';
      return baseDecision(
        'create-refactor-slice',
        reason,
        architect,
        {
          entropy: compactEntropy(entropy),
          recommendedCommand: resolveRefactorCommand(refactorRecommendation, policy),
          refactorRecommendation: compactRefactorRecommendation(refactorRecommendation),
        }
      );
    }
    if (entropyPressure === 'medium') {
      return baseDecision(
        'run-governance-validation',
        'OHDER entropy refactor pressure requires governance validation',
        architect,
        {
          entropy: compactEntropy(entropy),
          recommendedCommand: 'ask governance status',
        }
      );
    }

    const replayabilityRisk = normalizeLower(architect.replayabilityRisk);
    const score = architectureScore(architect);
    const minimumScore = toNumber(policy?.ohder_next_action?.minimum_architecture_score, 70);
    const governanceDecision = normalizeLower(state?.governanceDecision?.decision || state?.governanceDecision);
    if (replayabilityRisk === 'high' || score < minimumScore || governanceDecision === 'block') {
      const reason = replayabilityRisk === 'high'
        ? 'OHDER replayability risk is high'
        : governanceDecision === 'block'
          ? 'latest governance decision blocked continuation'
          : `architecture score ${String(score)} is below minimum ${String(minimumScore)}`;
      return baseDecision(
        'run-governance-validation',
        reason,
        architect,
        {
          recommendedCommand: 'ask governance status',
        }
      );
    }

    return baseDecision(
      'await-new-requirement',
      'architecture governance clear and no ready tasks available',
      architect,
      {
        entropy: compactEntropy(entropy),
      }
    );
  }
}

