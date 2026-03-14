import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';

export class HandoffEngine {
  constructor(cwd = process.cwd()) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async create() {
    const content = `# Latest Handoff

## Summary
- session paused

## Open Loops
- none

## Next Actions
- resume session
`;
    await this.store.writeText(this.paths.latestHandoff(), content);
    const activeSession = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    await this.ledger.append({
      type: 'SessionHandoffGenerated',
      sessionId: String(activeSession.sessionId || ''),
      actor: String(activeSession.actorId || 'local'),
      payload: {
        handoffPath: this.paths.latestHandoff(),
      },
      meta: {
        source: 'handoff-engine',
      },
    });
    await this.projectionEngine.replay();
    console.log('[ask-core] handoff created');
  }
}
