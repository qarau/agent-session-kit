function normalize(value) {
  return String(value ?? '').trim();
}

export class RoutingPolicyEngine {
  recommend({ task, verification, freshness } = {}) {
    const status = normalize(task?.status);
    const verificationStatus = normalize(verification?.status);
    const freshnessStatus = normalize(freshness?.status);

    if (freshnessStatus === 'stale') {
      return {
        requiredCapability: 'debugger',
        policy: 'status-based-routing',
        reason: 'task freshness is stale',
      };
    }

    if (status === 'created') {
      return {
        requiredCapability: 'planner',
        policy: 'status-based-routing',
        reason: 'task is newly created',
      };
    }

    if (status === 'in-progress') {
      return {
        requiredCapability: 'implementer',
        policy: 'status-based-routing',
        reason: 'task is in progress',
      };
    }

    if (status === 'completed' && verificationStatus !== 'passed') {
      return {
        requiredCapability: 'verifier',
        policy: 'status-based-routing',
        reason: 'task is completed but verification not passed',
      };
    }

    if (status === 'completed' && verificationStatus === 'passed') {
      return {
        requiredCapability: 'integrator',
        policy: 'status-based-routing',
        reason: 'task is completed and verified',
      };
    }

    return {
      requiredCapability: 'reviewer',
      policy: 'status-based-routing',
      reason: 'fallback routing policy',
    };
  }
}
