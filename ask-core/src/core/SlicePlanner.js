import { randomUUID } from 'node:crypto';
import { SlicePolicyEvaluator } from './SlicePolicyEvaluator.js';
import { SliceRiskLevels } from './SliceTypes.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map(value => normalize(value)).filter(Boolean);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class SlicePlanner {
  constructor() {
    this.policyEvaluator = new SlicePolicyEvaluator();
  }

  create(intent, state, policy = {}, options = {}) {
    const command = normalize(options.command || 'codex');
    const commandArgs = normalizeArray(options.commandArgs);
    const operation = normalize(options.operation || `autonomy-${normalize(intent.type) || 'slice'}`);
    const maxAttempts = toNumber(policy?.retry?.max_attempts_per_slice, 2);
    const nextAction = normalize(state?.nextRecommendedAction || intent?.reason || 'run next safe step');
    const touched = normalizeArray(state?.latestExecution?.touchedFiles || []);
    const baseCriteria = [
      `Execution status is completed for operation ${operation}`,
    ];
    const testEvidenceRequired = policy?.validation?.require_test_evidence !== false;
    if (testEvidenceRequired) {
      baseCriteria.push('Configured test command(s) succeed');
    }

    const slice = {
      id: `slice_${randomUUID()}`,
      sessionId: normalize(intent?.sessionId || state?.sessionId),
      intentId: normalize(intent?.id),
      title: normalize(`Execute: ${nextAction}`).slice(0, 120),
      objective: normalize(nextAction),
      allowedFiles: touched,
      expectedTouchedFiles: touched,
      allowedCommands: normalizeArray(options.allowedCommands),
      acceptanceCriteria: baseCriteria,
      riskLevel: SliceRiskLevels.LOW,
      maxAttempts: maxAttempts > 0 ? maxAttempts : 2,
      execution: {
        command,
        args: commandArgs,
        operation,
      },
      createdAt: new Date().toISOString(),
    };

    const decision = this.policyEvaluator.evaluate(slice, policy);
    if (!decision.allowed) {
      return {
        ok: false,
        code: 'slice-policy-blocked',
        message: decision.reason,
        slice,
      };
    }

    return {
      ok: true,
      slice,
    };
  }
}
