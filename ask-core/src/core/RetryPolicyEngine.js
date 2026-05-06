function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class RetryPolicyEngine {
  resolve(policy = {}) {
    return {
      maxAttemptsPerSlice: toNumber(policy?.retry?.max_attempts_per_slice, 2),
      maxSameFailureRepeats: toNumber(policy?.retry?.max_same_failure_repeats, 2),
      maxTotalFailuresPerSession: toNumber(policy?.retry?.max_total_failures_per_session, 5),
    };
  }

  shouldBlock(failureStats = {}, policy = {}) {
    const retry = this.resolve(policy);
    if ((failureStats.totalFailures || 0) >= retry.maxTotalFailuresPerSession) {
      return true;
    }
    if ((failureStats.sameFailureRepeats || 0) >= retry.maxSameFailureRepeats) {
      return true;
    }
    return false;
  }
}
