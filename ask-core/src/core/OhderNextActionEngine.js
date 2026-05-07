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
  decide({ state = {}, architect = {}, refactorGovernance = {}, tasks = {}, policy = {} } = {}) {
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
          recommendedCommand: 'ask task create <refactor-task-id>',
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
      architect
    );
  }
}
