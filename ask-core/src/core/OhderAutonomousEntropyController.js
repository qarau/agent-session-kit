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

function rank(value, ranks) {
  const normalized = normalizeLower(value);
  return ranks[normalized] ?? 0;
}

function selectedTarget(recommendation = {}) {
  const portfolio = Array.isArray(recommendation?.targetPortfolio) ? recommendation.targetPortfolio : [];
  return portfolio.find(item => item?.selected === true) || portfolio[0] || recommendation?.target || null;
}

function autonomyPolicy(policy = {}) {
  const settings = policy?.ohder_autonomy && typeof policy.ohder_autonomy === 'object'
    ? policy.ohder_autonomy
    : {};
  return {
    autoCreateRefactorTasks: settings.auto_create_refactor_tasks === true
      || policy?.refactor_materialization?.auto_materialize_high_confidence === true,
    maxAutoCreatedTasksPerSession: Math.max(0, Math.floor(toNumber(settings.max_auto_created_tasks_per_session, 1))),
    requireCleanWorktree: settings.require_clean_worktree !== false,
    minConfidence: normalizeLower(settings.min_confidence) || 'high',
    maxBlastRadius: normalizeLower(settings.max_blast_radius) || 'medium',
  };
}

export class OhderAutonomousEntropyController {
  evaluate({ recommendation = null, policy = {}, dirtyWorktree = false, autoCreatedCount = 0 } = {}) {
    const settings = autonomyPolicy(policy);
    const target = selectedTarget(recommendation || {});
    const confidenceRanks = { low: 1, medium: 2, high: 3 };
    const blastRanks = { low: 1, medium: 2, high: 3 };
    const confidence = normalizeLower(recommendation?.confidence);
    const blastRadius = normalizeLower(target?.blastRadius || recommendation?.blastRadius || 'medium');
    const base = {
      createTask: false,
      decision: '',
      reason: '',
      approvalRequired: false,
      patchApplicationAllowed: false,
      target,
      settings,
    };

    if (!recommendation) {
      return {
        ...base,
        decision: 'no-recommendation',
        reason: 'no OHDER refactor recommendation is available',
      };
    }
    if (!settings.autoCreateRefactorTasks) {
      return {
        ...base,
        decision: 'auto-disabled',
        reason: 'ohder_autonomy.auto_create_refactor_tasks is disabled',
      };
    }
    if (settings.requireCleanWorktree && dirtyWorktree) {
      return {
        ...base,
        decision: 'dirty-worktree',
        reason: 'autonomous refactor task creation requires a clean worktree',
      };
    }
    if (toNumber(autoCreatedCount, 0) >= settings.maxAutoCreatedTasksPerSession) {
      return {
        ...base,
        decision: 'limit-reached',
        reason: 'autonomous refactor task creation limit reached for this session',
      };
    }
    if (rank(confidence, confidenceRanks) < rank(settings.minConfidence, confidenceRanks)) {
      return {
        ...base,
        decision: 'confidence-too-low',
        reason: `recommendation confidence ${confidence || 'unknown'} is below policy minimum ${settings.minConfidence}`,
      };
    }
    if (rank(blastRadius, blastRanks) > rank(settings.maxBlastRadius, blastRanks)) {
      return {
        ...base,
        decision: 'approval-required',
        reason: `target blast radius ${blastRadius || 'unknown'} exceeds autonomous maximum ${settings.maxBlastRadius}`,
        approvalRequired: true,
      };
    }

    return {
      ...base,
      createTask: true,
      decision: 'create',
      reason: 'policy allows bounded autonomous refactor task creation',
    };
  }
}
