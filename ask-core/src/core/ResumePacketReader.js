import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

export class ResumePacketReader {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async read() {
    return this.store.readJson(this.paths.resumePacket(), {
      version: '1.0',
      sessionId: '',
      status: 'idle',
      nextAction: '',
      updatedAt: '',
    });
  }
}
