import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

export class EvidenceRecorder {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async readLatestChecks() {
    return this.store.readJson(this.paths.latestChecks(), {
      docsFresh: false,
      testsPassed: false,
      checks: [],
    });
  }

  async writeLatestChecks(payload) {
    await this.store.writeJson(this.paths.latestChecks(), payload);
  }
}
