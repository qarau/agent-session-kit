import { IntentTypes } from './IntentTypes.js';

function normalize(value) {
  return String(value ?? '').trim();
}

export class IntentPolicyEvaluator {
  evaluate(intent, state, policy = {}) {
    const type = normalize(intent?.type);
    const autonomyEnabled = policy?.autonomy?.enabled !== false;
    if (!autonomyEnabled && type !== IntentTypes.REQUEST_HUMAN_INPUT) {
      return {
        allowed: false,
        reason: 'autonomy disabled by policy',
      };
    }

    if (policy?.autonomy?.require_clean_worktree === true && state?.dirtyWorktree === true) {
      if (![IntentTypes.REQUEST_HUMAN_INPUT, IntentTypes.BLOCK].includes(type)) {
        return {
          allowed: false,
          reason: 'dirty worktree blocks autonomous intent',
        };
      }
    }

    if (type === IntentTypes.CLOSE && policy?.autonomy?.allow_until_complete !== true && state?.acceptanceCriteriaMet !== true) {
      return {
        allowed: false,
        reason: 'session completion criteria not met',
      };
    }

    return {
      allowed: true,
      reason: 'allowed',
    };
  }
}
