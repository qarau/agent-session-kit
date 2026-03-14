import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

export class RuntimeSnapshotStore {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async writeSession(payload) {
    await this.store.writeJson(this.paths.sessionSnapshot(), payload);
  }

  async writeTasks(payload) {
    await this.store.writeJson(this.paths.taskBoardSnapshot(), payload);
  }

  async writeVerification(payload) {
    await this.store.writeJson(this.paths.verificationSnapshot(), payload);
  }

  async writeWorkflow(payload) {
    await this.store.writeJson(this.paths.workflowSnapshot(), payload);
  }

  async writeFreshness(payload) {
    await this.store.writeJson(this.paths.freshnessSnapshot(), payload);
  }

  async writeIntegration(payload) {
    await this.store.writeJson(this.paths.integrationSnapshot(), payload);
  }

  async writeMergeReadiness(payload) {
    await this.store.writeJson(this.paths.mergeReadinessSnapshot(), payload);
  }

  async writeClaims(payload) {
    await this.store.writeJson(this.paths.claimsSnapshot(), payload);
  }

  async writeRouting(payload) {
    await this.store.writeJson(this.paths.routingSnapshot(), payload);
  }

  async writeChildSessions(payload) {
    await this.store.writeJson(this.paths.childSessionsSnapshot(), payload);
  }

  async writeAgents(payload) {
    await this.store.writeJson(this.paths.agentsSnapshot(), payload);
  }

  async writeQueueClasses(payload) {
    await this.store.writeJson(this.paths.queueClassesSnapshot(), payload);
  }

  async writePolicyPacks(payload) {
    await this.store.writeJson(this.paths.policyPacksSnapshot(), payload);
  }

  async writeFeatures(payload) {
    await this.store.writeJson(this.paths.featuresSnapshot(), payload);
  }

  async writeReleaseTrains(payload) {
    await this.store.writeJson(this.paths.releaseTrainsSnapshot(), payload);
  }

  async writePromotionGates(payload) {
    await this.store.writeJson(this.paths.promotionGatesSnapshot(), payload);
  }

  async writeRollout(payload) {
    await this.store.writeJson(this.paths.rolloutSnapshot(), payload);
  }
}
