import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_LOCK_RETRY_MS = 10;

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export class SequenceStore {
  constructor(cwd, options = {}) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    this.lockRetryMs = options.lockRetryMs ?? DEFAULT_LOCK_RETRY_MS;
  }

  lockPath() {
    return path.join(path.dirname(this.paths.sequenceState()), 'sequence.lock');
  }

  async acquireLock() {
    const lockPath = this.lockPath();
    await this.store.ensureDir(path.dirname(lockPath));
    const startedAt = Date.now();

    while (true) {
      try {
        const handle = await fs.open(lockPath, 'wx');
        await handle.writeFile(JSON.stringify({
          pid: process.pid,
          acquiredAt: new Date().toISOString(),
        }));
        return handle;
      } catch (error) {
        if (error?.code !== 'EEXIST') {
          throw error;
        }
        if (Date.now() - startedAt >= this.lockTimeoutMs) {
          const timeout = new Error(`timed out acquiring sequence lock: ${lockPath}`);
          timeout.code = 'sequence-lock-timeout';
          throw timeout;
        }
        await sleep(this.lockRetryMs);
      }
    }
  }

  async releaseLock(handle) {
    try {
      await handle?.close();
    } finally {
      await this.store.deleteFile(this.lockPath());
    }
  }

  async next() {
    const lock = await this.acquireLock();
    try {
      const state = await this.store.readJson(this.paths.sequenceState(), { nextSeq: 1 });
      const seq = Number(state.nextSeq) || 1;
      await this.store.writeJson(this.paths.sequenceState(), { nextSeq: seq + 1 });
      return seq;
    } finally {
      await this.releaseLock(lock);
    }
  }
}
