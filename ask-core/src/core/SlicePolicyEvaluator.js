function normalize(value) {
  return String(value ?? '').trim();
}

const REJECTED_PHRASES = [
  'refactor the whole runtime',
  'improve architecture',
  'clean everything up',
];

export class SlicePolicyEvaluator {
  evaluate(slice, policy = {}) {
    const title = normalize(slice?.title).toLowerCase();
    if (REJECTED_PHRASES.some(phrase => title.includes(phrase))) {
      return {
        allowed: false,
        reason: 'slice is too vague and open-ended',
      };
    }

    if (!normalize(slice?.objective)) {
      return {
        allowed: false,
        reason: 'slice objective is required',
      };
    }

    if (!Array.isArray(slice?.acceptanceCriteria) || slice.acceptanceCriteria.length < 1) {
      if (policy?.validation?.require_acceptance_criteria !== false) {
        return {
          allowed: false,
          reason: 'acceptance criteria required by policy',
        };
      }
    }

    return {
      allowed: true,
      reason: 'allowed',
    };
  }
}
