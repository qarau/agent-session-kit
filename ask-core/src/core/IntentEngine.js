import { randomUUID } from 'node:crypto';
import { IntentTypes } from './IntentTypes.js';
import { IntentPolicyEvaluator } from './IntentPolicyEvaluator.js';
import { RequirementAnalyzerEngine } from './RequirementAnalyzerEngine.js';

function nowIso() {
  return new Date().toISOString();
}

function normalize(value) {
  return String(value ?? '').trim();
}

export class IntentEngine {
  constructor() {
    this.policyEvaluator = new IntentPolicyEvaluator();
    this.requirementAnalyzer = new RequirementAnalyzerEngine();
  }

  createIntent(type, state, reason, confidence, requiresHuman = false, requirementAnalysis = null) {
    return {
      id: `intent_${randomUUID()}`,
      type,
      sessionId: normalize(state?.sessionId),
      reason: normalize(reason),
      confidence,
      requiresHuman,
      requirementAnalysis: requirementAnalysis || this.requirementAnalyzer.analyze(state || {}),
      createdAt: nowIso(),
    };
  }

  select(state, policy = {}) {
    const requirementAnalysis = this.requirementAnalyzer.analyze(state || {});
    if (!normalize(state?.sessionId) || ['idle', 'created', 'closed'].includes(normalize(state?.status))) {
      const intent = this.createIntent(
        IntentTypes.REQUEST_HUMAN_INPUT,
        state,
        'No runnable active session detected',
        1,
        true,
        requirementAnalysis
      );
      return this.withPolicyDecision(intent, state, policy);
    }

    if (state?.pendingTransitionExists) {
      const intent = this.createIntent(
        IntentTypes.RECOVER_PENDING_TRANSITION,
        state,
        'Pending transition exists and must be recovered first',
        1,
        false,
        requirementAnalysis
      );
      return this.withPolicyDecision(intent, state, policy);
    }

    if (!state?.continuityValid) {
      const intent = this.createIntent(
        IntentTypes.BLOCK,
        state,
        'Projection continuity is invalid',
        1,
        false,
        requirementAnalysis
      );
      return this.withPolicyDecision(intent, state, policy);
    }

    if (state?.failureStats?.exceedsSameFailure || state?.failureStats?.exceedsTotal) {
      const intent = this.createIntent(
        IntentTypes.BLOCK,
        state,
        'Failure retry threshold reached',
        0.98,
        false,
        requirementAnalysis
      );
      return this.withPolicyDecision(intent, state, policy);
    }

    const latestExecutionStatus = normalize(state?.latestExecution?.status).toLowerCase();
    if (latestExecutionStatus === 'failed' || latestExecutionStatus === 'timeout' || latestExecutionStatus === 'blocked') {
      const intent = this.createIntent(
        IntentTypes.FIX_FAILURE,
        state,
        `Latest execution failed with ${normalize(state?.failureStats?.lastFailureCode) || 'unknown failure'}`,
        0.95,
        false,
        requirementAnalysis
      );
      return this.withPolicyDecision(intent, state, policy);
    }

    if (latestExecutionStatus === 'completed' && state?.checkpointMatchesExecution !== true) {
      const intent = this.createIntent(
        IntentTypes.CHECKPOINT,
        state,
        'Execution completed without matching checkpoint',
        0.9,
        false,
        requirementAnalysis
      );
      return this.withPolicyDecision(intent, state, policy);
    }

    if (state?.acceptanceCriteriaMet === true) {
      const intent = this.createIntent(
        IntentTypes.CLOSE,
        state,
        'All tracked tasks are completed',
        0.9,
        false,
        requirementAnalysis
      );
      return this.withPolicyDecision(intent, state, policy);
    }

    if (normalize(state?.nextRecommendedAction)) {
      const intent = this.createIntent(
        IntentTypes.CREATE_SLICE,
        state,
        `Continuation recommends: ${normalize(state?.nextRecommendedAction)}`,
        0.86,
        false,
        requirementAnalysis
      );
      return this.withPolicyDecision(intent, state, policy);
    }

    const intent = this.createIntent(
      IntentTypes.SELECT_NEXT_TASK,
      state,
      'No explicit next action found; selecting next task',
      0.7,
      false,
      requirementAnalysis
    );
    return this.withPolicyDecision(intent, state, policy);
  }

  withPolicyDecision(intent, state, policy) {
    const decision = this.policyEvaluator.evaluate(intent, state, policy);
    if (decision.allowed) {
      return intent;
    }
    return {
      ...this.createIntent(
        IntentTypes.BLOCK,
        state,
        decision.reason,
        1
      ),
      blockedIntentType: intent.type,
      blockedIntentId: intent.id,
    };
  }
}
