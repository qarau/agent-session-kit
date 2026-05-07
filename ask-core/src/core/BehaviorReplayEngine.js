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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function includesText(haystack, needle) {
  return normalizeLower(haystack).includes(normalizeLower(needle));
}

function stageToMinConfidence(stage, policy = {}) {
  const normalized = normalizeLower(stage);
  if (normalized === 'hard-flow') {
    return toNumber(policy?.flow?.min_hard_flow_replay_confidence, 0.85);
  }
  if (normalized === 'protected') {
    return toNumber(policy?.flow?.min_protected_replay_confidence, 0.75);
  }
  return toNumber(policy?.flow?.min_behavior_replay_confidence, 0.65);
}

function toStatus(score, hasCriticalEvidence = false) {
  if (hasCriticalEvidence || score < 0.5) {
    return 'failed';
  }
  if (score < 0.75) {
    return 'warning';
  }
  return 'passed';
}

export class BehaviorReplayEngine {
  evaluate({ impactedFlows = [], execution = {}, validation = {}, policy = {} }) {
    const testsRun = Array.isArray(validation.testsRun) ? validation.testsRun : [];
    const failures = Array.isArray(validation.failures) ? validation.failures : [];
    const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
    const validationTexts = [...failures, ...warnings].map(item => normalize(item)).filter(Boolean);
    const flowReplays = [];
    const regressionEvidence = [];

    for (const flow of impactedFlows) {
      const expectedTests = Array.isArray(flow.expectedTests) ? flow.expectedTests : [];
      let score = 1;
      const evidence = [];
      let critical = false;
      const stage = normalizeLower(flow.stage || flow.criticality || 'experimental');

      if (execution.ok !== true) {
        score -= 0.35;
        evidence.push({
          type: 'execution-failed',
          severity: 'high',
          detail: `Execution failed for impacted flow ${flow.id}`,
        });
      }

      const validationStatus = normalizeLower(validation.status);
      if (validationStatus === 'failed' || validationStatus === 'blocked' || validationStatus === 'inconclusive') {
        score -= 0.35;
        evidence.push({
          type: 'validation-failed',
          severity: 'high',
          detail: `Validation status ${validationStatus || 'unknown'} for flow ${flow.id}`,
        });
      }

      if (expectedTests.length > 0) {
        const hasCoverage = expectedTests.every(required =>
          testsRun.some(test => includesText(test, required))
        );
        if (!hasCoverage) {
          score -= 0.25;
          evidence.push({
            type: 'missing-test-coverage',
            severity: stage === 'hard-flow' ? 'critical' : 'medium',
            detail: `Missing expected flow test evidence for ${flow.id}`,
            expectedTests,
          });
          if (stage === 'hard-flow') {
            critical = true;
          }
        }
      } else if (stage === 'protected' || stage === 'hard-flow') {
        score -= 0.15;
        evidence.push({
          type: 'no-expected-tests-configured',
          severity: stage === 'hard-flow' ? 'high' : 'medium',
          detail: `No expected tests configured for ${stage} flow ${flow.id}`,
        });
      }

      const mustNever = Array.isArray(flow.mustNever) ? flow.mustNever : [];
      for (const forbidden of mustNever) {
        const matched = validationTexts.some(text => includesText(text, forbidden));
        if (matched) {
          score -= 0.25;
          evidence.push({
            type: 'must-never-risk',
            severity: stage === 'hard-flow' ? 'critical' : 'high',
            detail: `Validation evidence references forbidden behavior for ${flow.id}`,
            forbidden,
          });
          if (stage === 'hard-flow' || stage === 'protected') {
            critical = true;
          }
        }
      }

      score = clamp(score, 0, 1);
      const minConfidence = stageToMinConfidence(stage, policy);
      if (score < minConfidence) {
        evidence.push({
          type: 'confidence-below-threshold',
          severity: stage === 'hard-flow' ? 'critical' : 'high',
          detail: `Replay confidence ${score.toFixed(3)} below threshold ${minConfidence.toFixed(3)} for ${flow.id}`,
          minConfidence,
        });
        if (stage === 'hard-flow') {
          critical = true;
        }
      }

      const status = toStatus(score, critical);
      const replay = {
        flowId: flow.id,
        stage,
        confidence: Number(score.toFixed(4)),
        minConfidence: Number(minConfidence.toFixed(4)),
        status,
        evidence,
      };
      flowReplays.push(replay);
      if (replay.evidence.length > 0) {
        regressionEvidence.push(...replay.evidence.map(item => ({
          ...item,
          flowId: flow.id,
          stage,
        })));
      }
    }

    const impactedCount = flowReplays.length;
    const aggregateConfidence = impactedCount > 0
      ? Number((flowReplays.reduce((sum, item) => sum + toNumber(item.confidence, 0), 0) / impactedCount).toFixed(4))
      : 1;
    const hasFailed = flowReplays.some(item => item.status === 'failed');
    const hasWarning = flowReplays.some(item => item.status === 'warning');
    const status = hasFailed ? 'failed' : hasWarning ? 'warning' : 'passed';

    return {
      status,
      confidence: aggregateConfidence,
      impactedFlowCount: impactedCount,
      flowReplays,
      regressionEvidence,
    };
  }
}
