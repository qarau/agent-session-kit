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

function baselineFor(task = {}) {
  const governance = task?.refactorGovernance && typeof task.refactorGovernance === 'object'
    ? task.refactorGovernance
    : {};
  const origin = task?.origin && typeof task.origin === 'object' ? task.origin : {};
  return governance.baseline || origin.refactorBaseline || {};
}

export class OhderRefactorOutcomeEngine {
  evaluate({ task = {}, architect = {}, entropy = {}, policy = {} } = {}) {
    const isRefactorTask = Boolean(task?.refactorGovernance)
      || normalize(task?.origin?.type) === 'ohder-refactor-governance';
    if (!isRefactorTask) {
      return {
        required: false,
        status: 'skipped',
        blocking: false,
        reason: 'not an OHDER refactor task',
      };
    }

    const baseline = baselineFor(task);
    const beforeScore = toNumber(baseline.architectureScore, 0);
    const beforeEntropy = toNumber(baseline.entropyScore, 0);
    const afterScore = toNumber(architect?.architectureScore?.overallScore, 0);
    const afterEntropy = toNumber(entropy?.entropyScore, 0);
    const scoreDelta = Math.round(afterScore - beforeScore);
    const entropyDelta = Number((afterEntropy - beforeEntropy).toFixed(4));
    const improved = (beforeScore > 0 && afterScore >= beforeScore) || (beforeEntropy > 0 && afterEntropy <= beforeEntropy);
    const justification = normalize(task?.refactorGovernance?.outcomeJustification || task?.origin?.refactorOutcomeJustification);
    const mode = normalizeLower(policy?.ohder?.mode) || 'fast';

    if (improved) {
      return {
        required: true,
        status: 'passed',
        blocking: false,
        reason: 'refactor outcome improved or held architecture entropy',
        before: { architectureScore: beforeScore, entropyScore: beforeEntropy },
        after: { architectureScore: afterScore, entropyScore: afterEntropy },
        scoreDelta,
        entropyDelta,
      };
    }

    if (justification) {
      return {
        required: true,
        status: 'justified',
        blocking: false,
        reason: `worsened refactor outcome justified: ${justification}`,
        justification,
        before: { architectureScore: beforeScore, entropyScore: beforeEntropy },
        after: { architectureScore: afterScore, entropyScore: afterEntropy },
        scoreDelta,
        entropyDelta,
      };
    }

    const blocking = mode === 'refactor';
    return {
      required: true,
      status: 'failed',
      blocking,
      reason: 'refactor outcome worsened without explicit justification',
      before: { architectureScore: beforeScore, entropyScore: beforeEntropy },
      after: { architectureScore: afterScore, entropyScore: afterEntropy },
      scoreDelta,
      entropyDelta,
    };
  }
}
