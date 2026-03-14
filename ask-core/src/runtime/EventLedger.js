import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { SequenceStore } from './SequenceStore.js';

function nowIso() {
  return new Date().toISOString();
}

export class EventLedger {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.sequences = new SequenceStore(cwd);
  }

  async append({ type, sessionId, taskId, actor = 'local', payload = {}, meta = {} }) {
    const seq = await this.sequences.next();
    const event = {
      seq,
      type,
      ts: nowIso(),
      sessionId,
      ...(taskId ? { taskId } : {}),
      actor,
      payload,
      meta,
    };
    await this.store.appendLine(this.paths.runtimeEvents(), JSON.stringify(event));
    return event;
  }

  async readAll() {
    const lines = await this.store.readLines(this.paths.runtimeEvents(), []);
    return lines.map(line => JSON.parse(line)).sort((left, right) => left.seq - right.seq);
  }
}
