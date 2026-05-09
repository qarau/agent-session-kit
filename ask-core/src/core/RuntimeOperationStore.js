import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

function nowIso() {
  return new Date().toISOString();
}

export class RuntimeOperationStore {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.writeQueue = Promise.resolve();
  }

  async read(fallback = null) {
    return this.store.readJson(this.paths.lastOperation(), fallback);
  }

  async write(state) {
    const payload = {
      ...state,
      updatedAt: state.updatedAt || nowIso(),
    };
    this.writeQueue = this.writeQueue.then(async () => {
      await this.store.writeJson(this.paths.lastOperation(), payload);
      return payload;
    });
    return this.writeQueue;
  }
}
