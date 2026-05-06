function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class ContextRecoveryCostEstimator {
  estimate({ execution = {}, validation = {}, policy = {} } = {}) {
    const touchedFiles = Array.isArray(execution.touchedFiles) ? execution.touchedFiles.length : 0;
    const criteriaCount = Array.isArray(validation.acceptanceCriteria) ? validation.acceptanceCriteria.length : 0;
    const base = 400;
    const estimatedTokens = base + touchedFiles * 220 + criteriaCount * 80;
    return {
      estimatedTokens,
      targetPercent: toNumber(policy?.context_recovery?.target_max_percent, 10),
    };
  }
}
