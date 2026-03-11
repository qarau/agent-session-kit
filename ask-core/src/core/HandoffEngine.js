import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

export class HandoffEngine {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
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
    console.log('[ask-core] handoff created');
  }
}
