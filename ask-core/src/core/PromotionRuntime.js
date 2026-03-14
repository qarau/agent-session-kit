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

function allGatesPassed(feature) {
  const gates = feature?.gates ?? {};
  const ids = Object.keys(gates);
  if (ids.length === 0) {
    return false;
  }
  return ids.every(id => String(gates[id]?.status ?? '') === 'passed');
}

export class PromotionRuntime {
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

  async readPromotionGates() {
    return this.store.readJson(this.paths.promotionGatesSnapshot(), { features: {} });
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
      meta: { source: 'promotion-runtime' },
    });
    await this.projectionEngine.replay();
  }

  async require(featureId, gateId) {
    const resolvedFeatureId = normalize(featureId);
    const resolvedGateId = normalize(gateId);

    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required');
    }
    if (!resolvedGateId) {
      return fail('missing-gate-id', 'promotion gate id is required', { featureId: resolvedFeatureId });
    }

    const features = await this.readFeatures();
    if (!features.features?.[resolvedFeatureId]) {
      return fail('feature-not-found', `feature not found: ${resolvedFeatureId}`, { featureId: resolvedFeatureId });
    }

    await this.appendEvent('PromotionGateRequired', {
      featureId: resolvedFeatureId,
      gateId: resolvedGateId,
    });

    const snapshot = await this.readPromotionGates();
    return {
      ok: true,
      promotion: snapshot.features?.[resolvedFeatureId] ?? null,
    };
  }

  async pass(featureId, gateId) {
    const resolvedFeatureId = normalize(featureId);
    const resolvedGateId = normalize(gateId);

    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required');
    }
    if (!resolvedGateId) {
      return fail('missing-gate-id', 'promotion gate id is required', { featureId: resolvedFeatureId });
    }

    const snapshot = await this.readPromotionGates();
    const feature = snapshot.features?.[resolvedFeatureId] ?? null;
    if (!feature?.gates?.[resolvedGateId]) {
      return fail('promotion-gate-not-required', `promotion gate is not required: ${resolvedGateId}`, {
        featureId: resolvedFeatureId,
        gateId: resolvedGateId,
      });
    }

    await this.appendEvent('PromotionGatePassed', {
      featureId: resolvedFeatureId,
      gateId: resolvedGateId,
    });

    const next = await this.readPromotionGates();
    return {
      ok: true,
      promotion: next.features?.[resolvedFeatureId] ?? null,
    };
  }

  async advance(featureId, stage) {
    const resolvedFeatureId = normalize(featureId);
    const resolvedStage = normalize(stage);

    if (!resolvedFeatureId) {
      return fail('missing-feature-id', 'feature id is required');
    }
    if (!resolvedStage) {
      return fail('missing-stage', 'promotion stage is required', { featureId: resolvedFeatureId });
    }

    const snapshot = await this.readPromotionGates();
    const feature = snapshot.features?.[resolvedFeatureId] ?? null;
    if (!feature || !allGatesPassed(feature)) {
      return fail('promotion-gates-unmet', 'all required promotion gates must pass before advance', {
        featureId: resolvedFeatureId,
      });
    }

    await this.appendEvent('PromotionAdvanced', {
      featureId: resolvedFeatureId,
      stage: resolvedStage,
    });

    const next = await this.readPromotionGates();
    return {
      ok: true,
      promotion: next.features?.[resolvedFeatureId] ?? null,
    };
  }

  async status(featureId = '') {
    const resolvedFeatureId = normalize(featureId);
    const snapshot = await this.readPromotionGates();
    const features = snapshot.features ?? {};

    if (!resolvedFeatureId) {
      return { ok: true, promotions: features };
    }

    const promotion = features[resolvedFeatureId];
    if (!promotion) {
      return fail('promotion-not-found', `promotion not found: ${resolvedFeatureId}`, { featureId: resolvedFeatureId });
    }

    return { ok: true, promotion };
  }
}
