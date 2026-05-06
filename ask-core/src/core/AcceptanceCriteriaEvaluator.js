function normalize(value) {
  return String(value ?? '').trim();
}

export class AcceptanceCriteriaEvaluator {
  evaluate(criteria = [], context = {}) {
    const normalized = Array.isArray(criteria)
      ? criteria.map(item => normalize(item)).filter(Boolean)
      : [];
    return normalized.map(text => ({
      text,
      status: context.executionOk ? 'passed' : 'failed',
      evidence: context.executionOk ? 'governed execution completed' : 'governed execution failed',
    }));
  }
}
