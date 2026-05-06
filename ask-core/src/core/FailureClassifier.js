function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

export class FailureClassifier {
  classify({ execution, validation, state }) {
    const executionStatus = normalize(execution?.status);
    const failureCode = normalize(execution?.failureCode);
    const validationStatus = normalize(validation?.status);

    if (!state?.continuityValid) {
      return 'projection_continuity_failure';
    }
    if (state?.dirtyWorktree) {
      return 'blocked_by_dirty_worktree';
    }
    if (executionStatus === 'timeout' || failureCode === 'command-timeout') {
      return 'timeout';
    }
    if (executionStatus === 'blocked' || failureCode.includes('policy') || failureCode.includes('preflight')) {
      return 'policy_failure';
    }
    if (validationStatus === 'failed' && validation?.failures?.some(item => normalize(item).includes('test'))) {
      return 'test_failure';
    }
    if (executionStatus === 'failed') {
      return 'command_failure';
    }
    if (!state?.checkpointMatchesExecution && executionStatus === 'completed') {
      return 'missing_checkpoint';
    }
    if (validationStatus === 'failed' || validationStatus === 'blocked' || validationStatus === 'inconclusive') {
      return 'unknown_runtime_error';
    }
    return '';
  }
}
