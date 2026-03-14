function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeList(list) {
  return Array.isArray(list)
    ? list.map(entry => normalize(entry)).filter(Boolean)
    : [];
}

export class DependencyGraph {
  constructor(edges = {}) {
    this.edges = new Map();
    const records = edges && typeof edges === 'object' ? edges : {};
    for (const [taskId, dependencies] of Object.entries(records)) {
      const resolvedTaskId = normalize(taskId);
      if (!resolvedTaskId) {
        continue;
      }
      this.edges.set(resolvedTaskId, new Set(normalizeList(dependencies)));
    }
  }

  dependsOn(taskId) {
    const resolvedTaskId = normalize(taskId);
    const set = this.edges.get(resolvedTaskId);
    if (!set) {
      return [];
    }
    return Array.from(set).sort();
  }

  dependentsOf(taskId) {
    const resolvedTaskId = normalize(taskId);
    if (!resolvedTaskId) {
      return [];
    }

    const dependents = [];
    for (const [sourceTaskId, dependencies] of this.edges.entries()) {
      if (dependencies.has(resolvedTaskId)) {
        dependents.push(sourceTaskId);
      }
    }
    return dependents.sort();
  }
}
