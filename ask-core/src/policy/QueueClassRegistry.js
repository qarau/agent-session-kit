function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

const CLASSES = [
  'planner',
  'implementer',
  'verifier',
  'debugger',
  'integrator',
  'reviewer',
];

export class QueueClassRegistry {
  list() {
    return [...CLASSES];
  }

  has(queueClass) {
    return CLASSES.includes(normalize(queueClass));
  }

  resolve(queueClass, fallback = 'reviewer') {
    const normalized = normalize(queueClass);
    if (this.has(normalized)) {
      return normalized;
    }
    return normalize(fallback);
  }
}
