import { FailureClassifier } from './FailureClassifier.js';
import { RetryPolicyEngine } from './RetryPolicyEngine.js';

export class FailureRecoveryEngine {
  constructor() {
    this.classifier = new FailureClassifier();
    this.retryPolicy = new RetryPolicyEngine();
  }

  decide({ state, execution, validation, slice, policy = {} }) {
    const failureType = this.classifier.classify({ execution, validation, state });
    const shouldBlock = this.retryPolicy.shouldBlock(state?.failureStats || {}, policy);
    if (!failureType) {
      return {
        status: 'continue',
        failureType: '',
        reason: 'no runtime failure detected',
      };
    }

    if (shouldBlock) {
      return {
        status: 'block',
        failureType,
        reason: `failure threshold reached (${failureType})`,
      };
    }

    return {
      status: 'retry',
      failureType,
      reason: `attempt recovery for ${failureType}`,
      recoverySliceHint: {
        title: `Recovery: ${slice?.title || 'slice'}`,
        objective: `Resolve ${failureType}`,
      },
    };
  }
}
