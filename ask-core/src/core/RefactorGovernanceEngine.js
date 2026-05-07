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

function nowIso() {
  return new Date().toISOString();
}

export class RefactorGovernanceEngine {
  evaluate({ architect = {}, flow = {}, policy = {}, slice = {} }) {
    const enabled = policy?.refactor_governance?.enabled !== false;
    if (!enabled) {
      return {
        required: false,
        status: 'skipped',
        reason: 'refactor governance disabled by policy',
        severity: 'none',
        hint: null,
        evaluatedAt: nowIso(),
      };
    }

    const reasons = [];
    const triggerOnArchitectFailed = policy?.refactor_governance?.trigger_on_architect_failed !== false;
    const triggerOnFlowReplayFailed = policy?.refactor_governance?.trigger_on_flow_replay_failed !== false;
    const architectFailed = normalizeLower(architect.status) === 'failed'
      || normalizeLower(architect.lawOutcome) === 'block'
      || normalizeLower(architect.lawOutcome) === 'retry';
    if (triggerOnArchitectFailed && architectFailed) {
      reasons.push(`architect: ${normalize(architect.reason) || normalize(architect.status)}`);
    }

    const flowReplayStatus = normalizeLower(flow?.behaviorReplay?.status);
    const flowReplayFailed = flowReplayStatus === 'failed';
    if (triggerOnFlowReplayFailed && flowReplayFailed) {
      reasons.push(`flow-replay: ${normalize(flow?.reason) || flowReplayStatus}`);
    }

    const highEntropy = toNumber(architect.entropyDelta, 0) > toNumber(policy?.architect?.max_entropy_delta, 3);
    if (highEntropy) {
      reasons.push(`entropy-delta ${String(architect.entropyDelta)} exceeded budget`);
    }
    const highCoupling = toNumber(architect.couplingDelta, 0) > toNumber(policy?.architect?.max_coupling_delta, 2);
    if (highCoupling) {
      reasons.push(`coupling-delta ${String(architect.couplingDelta)} exceeded budget`);
    }

    const required = reasons.length > 0;
    const hasHardFlowRisk = Array.isArray(flow.hardFlowViolations) && flow.hardFlowViolations.length > 0;
    const severity = !required
      ? 'none'
      : hasHardFlowRisk || normalizeLower(architect.lawOutcome) === 'block'
        ? 'high'
        : 'medium';

    const hint = required
      ? {
        title: `Refactor Governance: ${normalize(slice?.title) || 'slice'}`,
        objective: 'Reduce entropy/coupling risk and preserve replayability',
        recommendations: [
          'Reduce change surface and isolate responsibilities',
          'Increase targeted behavioral tests for impacted protected flows',
          'Re-run governed validation after refactor slice',
        ],
      }
      : null;

    return {
      required,
      status: required ? 'triggered' : 'not-required',
      reason: required ? reasons.join('; ') : 'no governance refactor trigger',
      severity,
      hint,
      evaluatedAt: nowIso(),
    };
  }

  revalidate({ architect = {}, flow = {}, trigger = {}, policy = {} }) {
    const enabled = policy?.refactor_governance?.enabled !== false;
    if (!enabled || trigger?.required !== true) {
      return {
        status: 'skipped',
        blocking: false,
        reason: 'no refactor governance trigger to revalidate',
        confidence: 1,
        checkedAt: nowIso(),
      };
    }

    const architectFailed = normalizeLower(architect.status) === 'failed';
    const flowReplayFailed = normalizeLower(flow?.behaviorReplay?.status) === 'failed';
    const failures = [];
    if (architectFailed) {
      failures.push('architect governance still failed');
    }
    if (flowReplayFailed) {
      failures.push('behavior replay still failed');
    }
    const failed = failures.length > 0;
    const blockOnFailure = policy?.refactor_governance?.block_on_revalidation_failure === true;
    const confidence = failed ? 0.34 : 0.92;
    return {
      status: failed ? 'failed' : 'passed',
      blocking: failed && blockOnFailure,
      reason: failed ? failures.join('; ') : 'revalidation passed',
      confidence,
      checkedAt: nowIso(),
    };
  }
}
