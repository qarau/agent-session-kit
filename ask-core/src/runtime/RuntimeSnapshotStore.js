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
}
