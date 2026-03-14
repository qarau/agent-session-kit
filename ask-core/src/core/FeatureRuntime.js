import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';

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

export class FeatureRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async readFeatures() {
    return this.store.readJson(this.paths.featuresSnapshot(), { features: {} });
  }

  async readTaskBoard() {
    return this.store.readJson(this.paths.taskBoardSnapshot(), { tasks: {} });
  }

  async getSessionContext() {
    const session = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    return {
      sessionId: normalize(session.sessionId),
      actor: normalize(session.actorId) || 'local',
    };
  }

  async appendEvent(type, payload = {}, taskId = '') {
    const context = await this.getSessionContext();
    await this.ledger.append({
      type,
      sessionId: context.sessionId,
      taskId: normalize(taskId),
      actor: context.actor,
      payload,
      meta: { source: 'feature-runtime' },
    });
    await this.projectionEngine.replay();
  }

  async create(featureId, title) {
    const resolvedFeatureId = normalize(featureId);
    const resolvedTitle = normalize(title);

    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required');
    }
    if (!resolvedTitle) {
      return fail('missing-title', 'feature title is required', { featureId: resolvedFeatureId });
    }

    const existing = await this.readFeatures();
    if (existing.features?.[resolvedFeatureId]) {
      return fail('feature-exists', `feature already exists: ${resolvedFeatureId}`, { featureId: resolvedFeatureId });
    }

    await this.appendEvent('FeatureCreated', {
      featureId: resolvedFeatureId,
      title: resolvedTitle,
    });

    const snapshot = await this.readFeatures();
    return {
      ok: true,
      feature: snapshot.features?.[resolvedFeatureId] ?? null,
    };
  }

  async linkTask(featureId, taskId) {
    const resolvedFeatureId = normalize(featureId);
    const resolvedTaskId = normalize(taskId);

    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required');
    }
    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required', { featureId: resolvedFeatureId });
    }

    const features = await this.readFeatures();
    if (!features.features?.[resolvedFeatureId]) {
      return fail('feature-not-found', `feature not found: ${resolvedFeatureId}`, { featureId: resolvedFeatureId });
    }

    const tasks = await this.readTaskBoard();
    if (!tasks.tasks?.[resolvedTaskId]) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    await this.appendEvent(
      'FeatureTaskLinked',
      {
        featureId: resolvedFeatureId,
        taskId: resolvedTaskId,
      },
      resolvedTaskId
    );

    const snapshot = await this.readFeatures();
    return {
      ok: true,
      feature: snapshot.features?.[resolvedFeatureId] ?? null,
    };
  }

  async status(featureId = '') {
    const resolvedFeatureId = normalize(featureId);
    const snapshot = await this.readFeatures();
    const features = snapshot.features ?? {};

    if (!resolvedFeatureId) {
      return { ok: true, features };
    }

    const feature = features[resolvedFeatureId];
    if (!feature) {
      return fail('feature-not-found', `feature not found: ${resolvedFeatureId}`, { featureId: resolvedFeatureId });
    }

    return { ok: true, feature };
  }
}
