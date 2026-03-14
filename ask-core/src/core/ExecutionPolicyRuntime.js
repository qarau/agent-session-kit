import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { QueueClassRegistry } from '../policy/QueueClassRegistry.js';
import { ExecutionPolicyPackRegistry } from '../policy/ExecutionPolicyPackRegistry.js';
import { TaskClassifier } from './TaskClassifier.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

export class ExecutionPolicyRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.queueClasses = new QueueClassRegistry();
    this.policyPacks = new ExecutionPolicyPackRegistry();
    this.classifier = new TaskClassifier();
  }

  async readJson(path, fallback) {
    return this.store.readJson(path, fallback);
  }

  async readTask(taskId) {
    const board = await this.readJson(this.paths.taskBoardSnapshot(), { tasks: {} });
    return board.tasks?.[taskId] ?? null;
  }

  async readVerification(taskId) {
    const verification = await this.readJson(this.paths.verificationSnapshot(), { tasks: {} });
    return verification.tasks?.[taskId] ?? null;
  }

  async readFreshness(taskId) {
    const freshness = await this.readJson(this.paths.freshnessSnapshot(), { tasks: {} });
    return freshness.tasks?.[taskId] ?? null;
  }

  async readMergeReadiness(taskId) {
    const mergeReadiness = await this.readJson(this.paths.mergeReadinessSnapshot(), { tasks: {} });
    return mergeReadiness.tasks?.[taskId] ?? null;
  }

  async readQueueClasses() {
    return this.readJson(this.paths.queueClassesSnapshot(), { tasks: {} });
  }

  async readPolicyPacks() {
    return this.readJson(this.paths.policyPacksSnapshot(), { tasks: {} });
  }

  async getSessionContext() {
    const session = await this.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    return {
      sessionId: normalize(session.sessionId),
      actor: normalize(session.actorId) || 'local',
    };
  }

  async appendEvent(type, taskId, payload = {}, meta = {}) {
    const context = await this.getSessionContext();
    await this.ledger.append({
      type,
      sessionId: context.sessionId,
      taskId,
      actor: context.actor,
      payload,
      meta,
    });
    await this.projectionEngine.replay();
  }

  async resolveQueueClass(taskId, overrideQueueClass = '') {
    const task = await this.readTask(taskId);
    if (!task) {
      return {
        ok: false,
        error: fail('task-not-found', `task not found: ${taskId}`, { taskId }),
      };
    }

    const override = normalize(overrideQueueClass).toLowerCase();
    if (override) {
      if (!this.queueClasses.has(override)) {
        return {
          ok: false,
          error: fail('queue-class-invalid', `invalid queue class: ${override}`, { queueClass: override }),
        };
      }
      return {
        ok: true,
        queueClass: override,
      };
    }

    const queueClass = this.classifier.classify({
      task,
      verification: await this.readVerification(taskId),
      freshness: await this.readFreshness(taskId),
      mergeReadiness: await this.readMergeReadiness(taskId),
    });

    return {
      ok: true,
      queueClass: this.queueClasses.resolve(queueClass),
    };
  }

  async classify(taskId, overrideQueueClass = '') {
    const resolvedTaskId = normalize(taskId);
    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }

    const resolved = await this.resolveQueueClass(resolvedTaskId, overrideQueueClass);
    if (!resolved.ok) {
      return resolved.error;
    }

    await this.appendEvent(
      'TaskClassified',
      resolvedTaskId,
      {
        queueClass: resolved.queueClass,
      },
      { source: 'execution-policy-runtime' }
    );

    const snapshot = await this.readQueueClasses();
    return {
      ok: true,
      taskId: resolvedTaskId,
      queueClass: resolved.queueClass,
      queue: snapshot.tasks?.[resolvedTaskId] ?? null,
    };
  }

  async apply(taskId, overrideQueueClass = '') {
    const classified = await this.classify(taskId, overrideQueueClass);
    if (!classified.ok) {
      return classified;
    }

    const decision = this.policyPacks.resolve(classified.queueClass);
    await this.appendEvent(
      'PolicyDecisionRecorded',
      classified.taskId,
      decision,
      { source: 'execution-policy-runtime' }
    );

    const snapshot = await this.readPolicyPacks();
    return {
      ok: true,
      taskId: classified.taskId,
      queueClass: classified.queueClass,
      decision,
      policy: snapshot.tasks?.[classified.taskId] ?? null,
    };
  }

  async status(taskId = '') {
    const resolvedTaskId = normalize(taskId);
    const queues = await this.readQueueClasses();
    const policies = await this.readPolicyPacks();

    if (!resolvedTaskId) {
      return {
        ok: true,
        queues: queues.tasks ?? {},
        policies: policies.tasks ?? {},
      };
    }

    const task = await this.readTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    return {
      ok: true,
      taskId: resolvedTaskId,
      queue: queues.tasks?.[resolvedTaskId] ?? null,
      policy: policies.tasks?.[resolvedTaskId] ?? null,
    };
  }
}
