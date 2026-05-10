import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import {
  createDefaultProjectionState,
  createDefaultReplayProof,
  mergeReplayProof,
  normalizeProjectionState,
} from './RuntimeSnapshotStoreRuntime.js';

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

  async readOhderFindings(fallback = { version: 1, updatedAt: '', findings: {} }) {
    return this.store.readJson(this.paths.ohderFindings(), fallback);
  }

  async writeOhderFindings(payload) {
    await this.store.writeJson(this.paths.ohderFindings(), payload);
  }

  async readProjectionState() {
    const state = await this.store.readJson(this.paths.projectionState(), createDefaultProjectionState());
    return normalizeProjectionState(state);
  }

  async writeProjectionState(payload = {}) {
    const state = normalizeProjectionState(payload);
    await this.store.writeJson(this.paths.projectionState(), state);
    return state;
  }

  async readReplayProof() {
    return this.store.readJson(this.paths.replayProof(), createDefaultReplayProof());
  }

  async writeReplayProof(payload = {}) {
    const previous = await this.readReplayProof();
    const next = mergeReplayProof(previous, payload);
    await this.store.writeJson(this.paths.replayProof(), next);
    return next;
  }
}
