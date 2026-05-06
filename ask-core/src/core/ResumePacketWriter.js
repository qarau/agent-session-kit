import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { ContextRecoveryCostEstimator } from './ContextRecoveryCostEstimator.js';

function normalize(value) {
  return String(value ?? '').trim();
}

export class ResumePacketWriter {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.estimator = new ContextRecoveryCostEstimator();
  }

  async write({ state, intent, slice, execution, validation, nextAction, policy = {} }) {
    const contextRecoveryCost = this.estimator.estimate({
      execution,
      validation,
      policy,
    });
    const payload = {
      version: '1.0',
      sessionId: normalize(state?.sessionId),
      goal: normalize(state?.goal),
      status: normalize(state?.status || 'active'),
      phase: normalize(validation?.status || execution?.status || 'checkpointed'),
      currentIntent: normalize(intent?.type),
      currentTask: normalize(state?.currentTask || slice?.title),
      lastCompleted: normalize(slice?.title),
      latestExecution: execution || {},
      latestValidation: validation || {},
      nextAction: normalize(nextAction || state?.nextRecommendedAction),
      riskNotes: [],
      contextRecoveryCost,
      updatedAt: new Date().toISOString(),
    };
    await this.store.writeJson(this.paths.resumePacket(), payload);
    return payload;
  }
}
