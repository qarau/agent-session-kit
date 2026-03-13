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
}
