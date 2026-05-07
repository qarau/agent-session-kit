import { PolicyEngine } from '../../core/PolicyEngine.js';
import { RuntimeStateEngine } from '../../core/RuntimeStateEngine.js';
import { TaskRuntime } from '../../core/TaskRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDependencyReady(taskMap, dependencyId) {
  const task = taskMap[dependencyId];
  if (!task) {
    return false;
  }
  const freshnessStatus = normalize(task.freshness?.status).toLowerCase();
  return freshnessStatus === 'fresh' || normalize(task.status).toLowerCase() === 'completed';
}

function taskSummary(task) {
  return {
    taskId: normalize(task.taskId),
    title: normalize(task.title),
    status: normalize(task.status),
    owner: normalize(task.owner),
    dependencies: Array.isArray(task.dependencies) ? [...task.dependencies] : [],
    freshness: normalize(task.freshness?.status),
    lastEventSeq: toNumber(task.lastEventSeq, 0),
  };
}

function chooseCurrentTask(tasks = []) {
  if (tasks.length < 1) {
    return null;
  }
  return [...tasks].sort((left, right) => toNumber(right.lastEventSeq, 0) - toNumber(left.lastEventSeq, 0))[0];
}

function chooseReadyTask(tasks = []) {
  if (tasks.length < 1) {
    return null;
  }
  return [...tasks].sort((left, right) => {
    const leftDeps = Array.isArray(left.dependencies) ? left.dependencies.length : 0;
    const rightDeps = Array.isArray(right.dependencies) ? right.dependencies.length : 0;
    if (leftDeps !== rightDeps) {
      return leftDeps - rightDeps;
    }
    return toNumber(left.lastEventSeq, 0) - toNumber(right.lastEventSeq, 0);
  })[0];
}

export async function runNext() {
  const cwd = process.cwd();
  const policyEngine = new PolicyEngine(cwd);
  const stateEngine = new RuntimeStateEngine(cwd);
  const taskRuntime = new TaskRuntime(cwd);
  const policy = await policyEngine.load();
  const state = await stateEngine.hydrate(policy);
  const taskStatus = await taskRuntime.status();
  const taskMap = taskStatus?.ok ? (taskStatus.tasks || {}) : {};
  const tasks = Object.values(taskMap).filter(Boolean);

  const activeTasks = tasks
    .filter(task => normalize(task.status).toLowerCase() === 'in-progress')
    .map(taskSummary);
  const readyTasks = tasks
    .filter(task => normalize(task.status).toLowerCase() === 'created')
    .filter(task => {
      const dependencies = Array.isArray(task.dependencies) ? task.dependencies : [];
      return dependencies.every(depId => isDependencyReady(taskMap, depId));
    })
    .map(taskSummary);
  const blockedByDependencies = tasks
    .filter(task => normalize(task.status).toLowerCase() === 'created')
    .filter(task => {
      const dependencies = Array.isArray(task.dependencies) ? task.dependencies : [];
      return dependencies.some(depId => !isDependencyReady(taskMap, depId));
    })
    .map(taskSummary);

  const currentTask = chooseCurrentTask(activeTasks);
  const readyTask = chooseReadyTask(readyTasks);
  let next = {
    type: 'runtime-action',
    action: normalize(state.nextRecommendedAction) || 'select next task',
    reason: 'no ready created tasks available',
  };

  if (readyTask) {
    next = {
      type: 'task-start',
      taskId: readyTask.taskId,
      title: readyTask.title,
      action: `ask task start ${readyTask.taskId}`,
      reason: 'dependency-ready created task',
    };
  } else if (currentTask) {
    next = {
      type: 'task-continue',
      taskId: currentTask.taskId,
      title: currentTask.title,
      action: `continue ${currentTask.taskId}`,
      reason: 'in-progress task currently active',
    };
  }

  const payload = {
    ok: true,
    runtime: {
      sessionId: normalize(state.sessionId),
      status: normalize(state.status),
      nextRecommendedAction: normalize(state.nextRecommendedAction),
      dirtyWorktree: state.dirtyWorktree === true,
      loopDecision: normalize(state.loop?.decision),
      governanceDecision: normalize(state.governanceDecision?.decision),
    },
    tasks: {
      active: activeTasks,
      ready: readyTasks,
      blockedByDependencies,
    },
    next,
  };
  console.log(JSON.stringify(payload, null, 2));
}
