import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

function nowIso() {
  return new Date().toISOString();
}

function normalize(value) {
  return String(value ?? '').trim();
}

export class GovernanceDecisionWriter {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async write(payload = {}) {
    const envelope = {
      loopId: normalize(payload.loopId),
      sessionId: normalize(payload.sessionId),
      sliceId: normalize(payload.sliceId),
      intentType: normalize(payload.intentType),
      decision: normalize(payload.decision),
      reason: normalize(payload.reason),
      recoveryStatus: normalize(payload.recoveryStatus),
      validationStatus: normalize(payload.validationStatus),
      architectStatus: normalize(payload.architectStatus),
      flowStatus: normalize(payload.flowStatus),
      blocking: payload.blocking === true,
      writtenAt: nowIso(),
    };
    await this.store.writeJson(this.paths.governanceDecision(), envelope);
    return envelope;
  }

  async read() {
    return this.store.readJson(this.paths.governanceDecision(), {
      loopId: '',
      sessionId: '',
      sliceId: '',
      intentType: '',
      decision: '',
      reason: '',
      recoveryStatus: '',
      validationStatus: '',
      architectStatus: '',
      flowStatus: '',
      blocking: false,
      writtenAt: '',
    });
  }
}
