function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

export class TaskClassifier {
  classify({ task, verification, freshness, mergeReadiness } = {}) {
    const taskStatus = normalize(task?.status);
    const verificationStatus = normalize(verification?.status);
    const freshnessStatus = normalize(freshness?.status);
    const mergeStatus = normalize(mergeReadiness?.status);

    if (verificationStatus === 'failed' || freshnessStatus === 'stale') {
      return 'debugger';
    }

    if (taskStatus === 'created') {
      return 'planner';
    }

    if (taskStatus === 'in-progress') {
      return 'implementer';
    }

    if (taskStatus === 'completed' && verificationStatus !== 'passed') {
      return 'verifier';
    }

    if (taskStatus === 'completed' && verificationStatus === 'passed' && mergeStatus !== 'ready') {
      return 'integrator';
    }

    return 'reviewer';
  }
}
