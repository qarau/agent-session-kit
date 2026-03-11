import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

async function getGitValue(cwd, args, allowFailure = false) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return stdout.trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }
    throw error;
  }
}

export class SessionRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async start() {
    const branch = await getGitValue(this.cwd, ['branch', '--show-current'], true);
    const worktree = await getGitValue(this.cwd, ['rev-parse', '--show-toplevel'], true);
    const session = createSession({
      status: 'active',
      branch,
      worktree,
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
