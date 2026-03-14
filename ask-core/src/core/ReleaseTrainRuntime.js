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

export class ReleaseTrainRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async readReleaseTrains() {
    return this.store.readJson(this.paths.releaseTrainsSnapshot(), { trains: {} });
  }

  async readFeatures() {
    return this.store.readJson(this.paths.featuresSnapshot(), { features: {} });
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
      meta: { source: 'release-train-runtime' },
    });
    await this.projectionEngine.replay();
  }

  async create(trainId, title) {
    const resolvedTrainId = normalize(trainId);
    const resolvedTitle = normalize(title);

    if (!resolvedTrainId) {
      return fail('missing-release-id', 'release train id is required');
    }
    if (!resolvedTitle) {
      return fail('missing-title', 'release train title is required', { releaseId: resolvedTrainId });
    }

    const existing = await this.readReleaseTrains();
    if (existing.trains?.[resolvedTrainId]) {
      return fail('release-exists', `release train already exists: ${resolvedTrainId}`, { releaseId: resolvedTrainId });
    }

    await this.appendEvent('ReleaseTrainCreated', {
      trainId: resolvedTrainId,
      title: resolvedTitle,
    });

    const snapshot = await this.readReleaseTrains();
    return {
      ok: true,
      release: snapshot.trains?.[resolvedTrainId] ?? null,
    };
  }

  async linkFeature(trainId, featureId) {
    const resolvedTrainId = normalize(trainId);
    const resolvedFeatureId = normalize(featureId);

    if (!resolvedTrainId) {
      return fail('missing-release-id', 'release train id is required');
    }
    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required', { releaseId: resolvedTrainId });
    }

    const trains = await this.readReleaseTrains();
    if (!trains.trains?.[resolvedTrainId]) {
      return fail('release-not-found', `release train not found: ${resolvedTrainId}`, { releaseId: resolvedTrainId });
    }

    const features = await this.readFeatures();
    if (!features.features?.[resolvedFeatureId]) {
      return fail('feature-not-found', `feature not found: ${resolvedFeatureId}`, { featureId: resolvedFeatureId });
    }

    await this.appendEvent('ReleaseFeatureLinked', {
      trainId: resolvedTrainId,
      featureId: resolvedFeatureId,
    });

    const snapshot = await this.readReleaseTrains();
    return {
      ok: true,
      release: snapshot.trains?.[resolvedTrainId] ?? null,
    };
  }

  async status(trainId = '') {
    const resolvedTrainId = normalize(trainId);
    const snapshot = await this.readReleaseTrains();
    const trains = snapshot.trains ?? {};

    if (!resolvedTrainId) {
      return { ok: true, releases: trains };
    }

    const release = trains[resolvedTrainId];
    if (!release) {
      return fail('release-not-found', `release train not found: ${resolvedTrainId}`, { releaseId: resolvedTrainId });
    }

    return { ok: true, release };
  }
}
