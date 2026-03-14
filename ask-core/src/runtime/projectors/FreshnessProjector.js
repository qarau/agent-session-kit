import { DependencyGraph } from '../DependencyGraph.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createTaskState(previous = {}, taskId = '') {
  return {
    taskId: normalize(previous.taskId) || normalize(taskId),
    dependencies: Array.isArray(previous.dependencies)
      ? previous.dependencies.map(entry => normalize(entry)).filter(Boolean).sort()
      : [],
    verificationStatus: normalize(previous.verificationStatus) || 'unknown',
    verificationPassedSeq: toNumber(previous.verificationPassedSeq),
    verificationPassedAt: normalize(previous.verificationPassedAt),
    lastTaskChangeSeq: toNumber(previous.lastTaskChangeSeq),
    lastTaskChangeAt: normalize(previous.lastTaskChangeAt),
    status: normalize(previous.status) || 'unverified',
    reasonCode: normalize(previous.reasonCode) || 'verification-not-passed',
    blockingDependencies: Array.isArray(previous.blockingDependencies)
      ? previous.blockingDependencies.map(entry => normalize(entry)).filter(Boolean).sort()
      : [],
    lastEventSeq: toNumber(previous.lastEventSeq),
    lastEventType: normalize(previous.lastEventType),
    updatedAt: normalize(previous.updatedAt),
  };
}

function createStateMap(state) {
  const map = new Map();
  const tasks = state?.tasks ?? {};
  for (const [taskId, task] of Object.entries(tasks)) {
    map.set(taskId, createTaskState(task, taskId));
  }
  return map;
}

function isTaskChangeEvent(type) {
  return [
    'TaskCreated',
    'TaskAssigned',
    'TaskStarted',
    'TaskCompleted',
    'TaskBlocked',
  ].includes(type);
}

function ensureTask(map, taskId) {
  const resolvedTaskId = normalize(taskId);
  if (!resolvedTaskId) {
    return null;
  }
  const existing = map.get(resolvedTaskId);
  if (existing) {
    return existing;
  }
  const next = createTaskState({}, resolvedTaskId);
  map.set(resolvedTaskId, next);
  return next;
}

function updateTaskForEvent(map, event) {
  const taskId = normalize(event.taskId);
  const type = normalize(event.type);
  const seq = toNumber(event.seq);
  const ts = normalize(event.ts);

  if (!taskId) {
    return;
  }

  if (isTaskChangeEvent(type)) {
    const task = ensureTask(map, taskId);
    if (!task) {
      return;
    }
    task.lastTaskChangeSeq = seq;
    task.lastTaskChangeAt = ts;
    return;
  }

  if (type === 'TaskDependencyAdded') {
    const task = ensureTask(map, taskId);
    const dependencyTaskId = normalize(event.payload?.dependencyTaskId);
    if (!task || !dependencyTaskId) {
      return;
    }
    ensureTask(map, dependencyTaskId);
    const deps = new Set(task.dependencies);
    deps.add(dependencyTaskId);
    task.dependencies = Array.from(deps).sort();
    task.lastTaskChangeSeq = seq;
    task.lastTaskChangeAt = ts;
    return;
  }

  if (type === 'VerificationPassed') {
    const task = ensureTask(map, taskId);
    if (!task) {
      return;
    }
    task.verificationStatus = 'passed';
    task.verificationPassedSeq = seq;
    task.verificationPassedAt = ts;
    return;
  }

  if (type === 'VerificationFailed') {
    const task = ensureTask(map, taskId);
    if (!task) {
      return;
    }
    task.verificationStatus = 'failed';
    task.verificationPassedSeq = 0;
    task.verificationPassedAt = '';
  }
}

function computeFreshness(task, map, graph) {
  if (task.verificationStatus !== 'passed') {
    return {
      status: 'unverified',
      reasonCode: 'verification-not-passed',
      blockingDependencies: [],
    };
  }

  const deps = graph.dependsOn(task.taskId);
  const blocking = deps.filter(dependencyTaskId => {
    const dependency = map.get(dependencyTaskId);
    return dependency && dependency.lastTaskChangeSeq > task.verificationPassedSeq;
  });

  if (blocking.length > 0) {
    return {
      status: 'stale',
      reasonCode: 'dependency-updated-after-verification',
      blockingDependencies: blocking.sort(),
    };
  }

  return {
    status: 'fresh',
    reasonCode: 'verification-fresh',
    blockingDependencies: [],
  };
}

function snapshot(map) {
  const tasks = {};
  const ordered = Array.from(map.entries()).sort(([left], [right]) => left.localeCompare(right));
  for (const [taskId, task] of ordered) {
    tasks[taskId] = {
      ...task,
      dependencies: [...task.dependencies].sort(),
      blockingDependencies: [...task.blockingDependencies].sort(),
    };
  }
  return { tasks };
}

export class FreshnessProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const map = createStateMap(state);
    const taskId = normalize(event.taskId);
    const seq = toNumber(event.seq);
    const ts = normalize(event.ts);
    const type = normalize(event.type);

    updateTaskForEvent(map, event);
    const graph = new DependencyGraph(
      Object.fromEntries(
        Array.from(map.entries()).map(([id, task]) => [id, task.dependencies])
      )
    );

    for (const task of map.values()) {
      const freshness = computeFreshness(task, map, graph);
      task.status = freshness.status;
      task.reasonCode = freshness.reasonCode;
      task.blockingDependencies = freshness.blockingDependencies;
      if (task.taskId === taskId) {
        task.lastEventSeq = seq;
        task.lastEventType = type;
        task.updatedAt = ts;
      } else if (task.lastEventSeq === 0 && task.updatedAt === '') {
        task.updatedAt = ts;
      }
    }

    return snapshot(map);
  }
}
