function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function rank(value, ranks) {
  return ranks[normalizeLower(value)] ?? 0;
}

function selectedTarget(recommendation = {}) {
  const portfolio = Array.isArray(recommendation?.targetPortfolio) ? recommendation.targetPortfolio : [];
  return portfolio.find(item => item?.selected === true) || portfolio[0] || recommendation?.target || {};
}

function hasHighRiskSemanticFacts(facts = []) {
  return (Array.isArray(facts) ? facts : []).some(fact => {
    const value = normalizeLower(fact?.value);
    const confidence = normalizeLower(fact?.confidence);
    return confidence === 'high' && ['invalid', 'high', 'at-risk', 'failed', 'false'].includes(value);
  });
}

export class OhderPatchReadinessGate {
  evaluate({
    recommendation = {},
    matchingTests = [],
    rollbackPlan = '',
    cleanWorktree = false,
    approval = {},
    semanticFacts = [],
  } = {}) {
    const blockers = [];
    const blastRanks = { low: 1, medium: 2, high: 3 };
    const target = selectedTarget(recommendation);

    if (normalizeLower(recommendation?.confidence) !== 'high') {
      blockers.push('recommendation confidence must be high');
    }
    if (rank(target?.blastRadius || recommendation?.blastRadius || 'medium', blastRanks) > blastRanks.low) {
      blockers.push('blast radius must be low');
    }
    if (!Array.isArray(matchingTests) || matchingTests.length < 1) {
      blockers.push('matching tests are required');
    }
    if (!normalize(rollbackPlan)) {
      blockers.push('rollback plan is required');
    }
    if (cleanWorktree !== true) {
      blockers.push('clean worktree is required');
    }
    if (approval?.required === true && approval?.approved !== true) {
      blockers.push('required approval is missing');
    }
    if (hasHighRiskSemanticFacts(semanticFacts)) {
      blockers.push('high-confidence semantic risk facts must be resolved');
    }

    return {
      patchReady: blockers.length === 0,
      patchExecutionAllowed: false,
      blockers,
      target,
      evidence: {
        matchingTests: Array.isArray(matchingTests) ? matchingTests.map(normalize).filter(Boolean) : [],
        rollbackPlan: normalize(rollbackPlan),
        cleanWorktree: cleanWorktree === true,
      },
    };
  }
}
