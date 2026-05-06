function normalizeSessionState(session = {}) {
  return String(session.status || 'created').toLowerCase();
}

function resolveAllowedStates(policySection, key, fallback = []) {
  const value = policySection?.[key];
  if (Array.isArray(value)) {
    return value.map(entry => String(entry ?? '').trim().toLowerCase()).filter(Boolean);
  }
  return [...fallback];
}

export function evaluatePreflightGate(policy = {}, session = {}, context = {}) {
  const missing = [];
  const sessionState = normalizeSessionState(session);
  const allowedStates = resolveAllowedStates(policy.session, 'allowed_preflight_states', ['active', 'paused']);

  if (policy.session?.require_resume_before_edit !== false && !allowedStates.includes(sessionState)) {
    missing.push(`session state ${sessionState} not allowed for preflight`);
  }

  if (!context.branch) {
    missing.push('context verify required');
  }

  return {
    missing,
    sessionState,
    allowedStates,
  };
}

export function evaluateCanCommitGate(policy = {}, session = {}, evidence = {}) {
  const missing = [];
  const sessionState = normalizeSessionState(session);
  const allowedStates = resolveAllowedStates(policy.session, 'allowed_can_commit_states', ['active', 'paused']);

  if (policy.checks?.require_docs_freshness && !evidence.docsFresh) {
    missing.push('docs freshness');
  }

  if (policy.checks?.require_tests_before_commit && !evidence.testsPassed) {
    missing.push('tests');
  }

  if (!allowedStates.includes(sessionState)) {
    missing.push(`session state ${sessionState} not allowed for can-commit`);
  }

  return {
    missing,
    sessionState,
    allowedStates,
  };
}
