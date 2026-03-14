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

export class RolloutRuntime {
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

  async readRollout() {
    return this.store.readJson(this.paths.rolloutSnapshot(), { features: {} });
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
      meta: { source: 'rollout-runtime' },
    });
    await this.projectionEngine.replay();
  }

  async assertFeature(featureId) {
    const resolvedFeatureId = normalize(featureId);
    const features = await this.readFeatures();
    if (!features.features?.[resolvedFeatureId]) {
      return fail('feature-not-found', `feature not found: ${resolvedFeatureId}`, { featureId: resolvedFeatureId });
    }
    return { ok: true };
  }

  async start(featureId, phase) {
    const resolvedFeatureId = normalize(featureId);
    const resolvedPhase = normalize(phase);

    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required');
    }
    if (!resolvedPhase) {
      return fail('missing-phase', 'rollout phase is required', { featureId: resolvedFeatureId });
    }

    const featureCheck = await this.assertFeature(resolvedFeatureId);
    if (!featureCheck.ok) {
      return featureCheck;
    }

    await this.appendEvent('RolloutStarted', {
      featureId: resolvedFeatureId,
      phase: resolvedPhase,
    });

    const snapshot = await this.readRollout();
    return {
      ok: true,
      rollout: snapshot.features?.[resolvedFeatureId] ?? null,
    };
  }

  async phase(featureId, phase) {
    const resolvedFeatureId = normalize(featureId);
    const resolvedPhase = normalize(phase);

    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required');
    }
    if (!resolvedPhase) {
      return fail('missing-phase', 'rollout phase is required', { featureId: resolvedFeatureId });
    }

    const featureCheck = await this.assertFeature(resolvedFeatureId);
    if (!featureCheck.ok) {
      return featureCheck;
    }

    await this.appendEvent('RolloutPhaseSet', {
      featureId: resolvedFeatureId,
      phase: resolvedPhase,
    });

    const snapshot = await this.readRollout();
    return {
      ok: true,
      rollout: snapshot.features?.[resolvedFeatureId] ?? null,
    };
  }

  async rollback(featureId, reason) {
    const resolvedFeatureId = normalize(featureId);
    const resolvedReason = normalize(reason);

    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required');
    }
    if (!resolvedReason) {
      return fail('missing-reason', 'rollback reason is required', { featureId: resolvedFeatureId });
    }

    const featureCheck = await this.assertFeature(resolvedFeatureId);
    if (!featureCheck.ok) {
      return featureCheck;
    }

    await this.appendEvent('RollbackTriggered', {
      featureId: resolvedFeatureId,
      reason: resolvedReason,
    });

    const snapshot = await this.readRollout();
    return {
      ok: true,
      rollout: snapshot.features?.[resolvedFeatureId] ?? null,
    };
  }

  async status(featureId = '') {
    const resolvedFeatureId = normalize(featureId);
    const snapshot = await this.readRollout();
    const features = snapshot.features ?? {};

    if (!resolvedFeatureId) {
      return { ok: true, rollouts: features };
    }

    const rollout = features[resolvedFeatureId];
    if (!rollout) {
      return fail('rollout-not-found', `rollout not found: ${resolvedFeatureId}`, { featureId: resolvedFeatureId });
    }

    return { ok: true, rollout };
  }
}
