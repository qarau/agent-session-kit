import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

export class SequenceStore {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async next() {
    const state = await this.store.readJson(this.paths.sequenceState(), { nextSeq: 1 });
    const seq = Number(state.nextSeq) || 1;
    await this.store.writeJson(this.paths.sequenceState(), { nextSeq: seq + 1 });
    return seq;
  }
}
