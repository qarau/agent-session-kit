import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import {
  createEventLedgerEnvelope,
  parseEventLedgerLine,
  sortEventLedgerRecords,
} from './EventLedgerRuntime.js';
import { SequenceStore } from './SequenceStore.js';

export class EventLedger {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.sequences = new SequenceStore(cwd);
  }

  async append({ type, sessionId, taskId, actor = 'local', payload = {}, meta = {} }) {
    const seq = await this.sequences.next();
    const event = createEventLedgerEnvelope({
      actor,
      meta,
      payload,
      sessionId,
      taskId,
      type,
    }, seq);
    await this.store.appendLine(this.paths.runtimeEvents(), JSON.stringify(event));
    return event;
  }

  async readAll() {
    const lines = await this.store.readLines(this.paths.runtimeEvents(), []);
    return sortEventLedgerRecords(lines.map(line => parseEventLedgerLine(line)));
  }
}
