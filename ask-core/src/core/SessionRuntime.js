import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

function nowIso() {
  return new Date().toISOString();
}

function createSession(overrides = {}) {
  return {
    sessionId: `sess_${Date.now().toString(36)}`,
    status: 'idle',
    branch: '',
    worktree: '',
    taskId: '',
    actorType: 'human',
    actorId: 'local',
    startedAt: '',
    lastActiveAt: '',
    ...overrides,
  };
}

export class SessionRuntime {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async start() {
    const session = createSession({
      status: 'active',
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
    });
    await this.store.writeJson(this.paths.activeSession(), session);
    console.log(JSON.stringify(session, null, 2));
  }

  async resume() {
    const session = await this.getActiveSession();
    session.status = 'active';
    session.lastActiveAt = nowIso();
    await this.store.writeJson(this.paths.activeSession(), session);
    console.log(JSON.stringify(session, null, 2));
  }

  async status() {
    const session = await this.getActiveSession();
    console.log(JSON.stringify(session, null, 2));
  }

  async close() {
    const session = await this.getActiveSession();
    session.status = 'closed';
    session.lastActiveAt = nowIso();
    await this.store.writeJson(this.paths.activeSession(), session);
    console.log(JSON.stringify(session, null, 2));
  }

  async getActiveSession() {
    return this.store.readJson(this.paths.activeSession(), createSession());
  }
}
