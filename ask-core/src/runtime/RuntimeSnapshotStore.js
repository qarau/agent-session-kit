import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

function defaultProjectionState() {
  return {
    lastAppliedSeq: 0,
    requiresReplay: false,
    reason: '',
    updatedAt: '',
  };
}

function defaultReplayProof() {
  return {
    schemaVersion: 1,
    mode: 'none',
    eventCount: 0,
    firstSeq: 0,
    lastSeq: 0,
    projectionCursor: 0,
    replayHash: '',
    snapshotHash: '',
    sequenceIntegrity: {
      contiguous: true,
      monotonic: true,
      hasDuplicates: false,
      hasGaps: false,
      cursorIntegrity: 'unknown',
    },
    generatedAt: '',
  };
}

export class RuntimeSnapshotStore {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async readSession(fallback = {}) {
    return this.store.readJson(this.paths.sessionSnapshot(), fallback);
  }

  async writeSession(payload) {
    await this.store.writeJson(this.paths.sessionSnapshot(), payload);
  }

  async readTasks(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.taskBoardSnapshot(), fallback);
  }

  async writeTasks(payload) {
    await this.store.writeJson(this.paths.taskBoardSnapshot(), payload);
  }

  async readVerification(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.verificationSnapshot(), fallback);
  }

  async writeVerification(payload) {
    await this.store.writeJson(this.paths.verificationSnapshot(), payload);
  }

  async readWorkflow(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.workflowSnapshot(), fallback);
  }

  async writeWorkflow(payload) {
    await this.store.writeJson(this.paths.workflowSnapshot(), payload);
  }

  async readFreshness(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.freshnessSnapshot(), fallback);
  }

  async writeFreshness(payload) {
    await this.store.writeJson(this.paths.freshnessSnapshot(), payload);
  }

  async readIntegration(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.integrationSnapshot(), fallback);
  }

  async writeIntegration(payload) {
    await this.store.writeJson(this.paths.integrationSnapshot(), payload);
  }

  async readMergeReadiness(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.mergeReadinessSnapshot(), fallback);
  }

  async writeMergeReadiness(payload) {
    await this.store.writeJson(this.paths.mergeReadinessSnapshot(), payload);
  }

  async readClaims(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.claimsSnapshot(), fallback);
  }

  async writeClaims(payload) {
    await this.store.writeJson(this.paths.claimsSnapshot(), payload);
  }

  async readRouting(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.routingSnapshot(), fallback);
  }

  async writeRouting(payload) {
    await this.store.writeJson(this.paths.routingSnapshot(), payload);
  }

  async readChildSessions(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.childSessionsSnapshot(), fallback);
  }

  async writeChildSessions(payload) {
    await this.store.writeJson(this.paths.childSessionsSnapshot(), payload);
  }

  async readAgents(fallback = { agents: {} }) {
    return this.store.readJson(this.paths.agentsSnapshot(), fallback);
  }

  async writeAgents(payload) {
    await this.store.writeJson(this.paths.agentsSnapshot(), payload);
  }

  async readQueueClasses(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.queueClassesSnapshot(), fallback);
  }

  async writeQueueClasses(payload) {
    await this.store.writeJson(this.paths.queueClassesSnapshot(), payload);
  }

  async readPolicyPacks(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.policyPacksSnapshot(), fallback);
  }

  async writePolicyPacks(payload) {
    await this.store.writeJson(this.paths.policyPacksSnapshot(), payload);
  }

  async readFeatures(fallback = { features: {} }) {
    return this.store.readJson(this.paths.featuresSnapshot(), fallback);
  }

  async writeFeatures(payload) {
    await this.store.writeJson(this.paths.featuresSnapshot(), payload);
  }

  async readReleaseTrains(fallback = { trains: {} }) {
    return this.store.readJson(this.paths.releaseTrainsSnapshot(), fallback);
  }

  async writeReleaseTrains(payload) {
    await this.store.writeJson(this.paths.releaseTrainsSnapshot(), payload);
  }

  async readPromotionGates(fallback = { features: {} }) {
    return this.store.readJson(this.paths.promotionGatesSnapshot(), fallback);
  }

  async writePromotionGates(payload) {
    await this.store.writeJson(this.paths.promotionGatesSnapshot(), payload);
  }

  async readRollout(fallback = { features: {} }) {
    return this.store.readJson(this.paths.rolloutSnapshot(), fallback);
  }

  async writeRollout(payload) {
    await this.store.writeJson(this.paths.rolloutSnapshot(), payload);
  }

  async readSubagentDispatch(fallback = { tasks: {} }) {
    return this.store.readJson(this.paths.subagentDispatchSnapshot(), fallback);
  }

  async writeSubagentDispatch(payload) {
    await this.store.writeJson(this.paths.subagentDispatchSnapshot(), payload);
  }

  async readProjectionState() {
    return this.store.readJson(this.paths.projectionState(), defaultProjectionState());
  }

  async writeProjectionState(payload = {}) {
    const state = {
      ...defaultProjectionState(),
      ...payload,
      lastAppliedSeq: Number(payload.lastAppliedSeq ?? 0) || 0,
      requiresReplay: payload.requiresReplay === true,
      updatedAt: payload.updatedAt || new Date().toISOString(),
    };
    await this.store.writeJson(this.paths.projectionState(), state);
    return state;
  }

  async readReplayProof() {
    return this.store.readJson(this.paths.replayProof(), defaultReplayProof());
  }

  async writeReplayProof(payload = {}) {
    const previous = await this.readReplayProof();
    const next = {
      ...previous,
      ...payload,
      generatedAt: payload.generatedAt || new Date().toISOString(),
    };
    await this.store.writeJson(this.paths.replayProof(), next);
    return next;
  }
}
