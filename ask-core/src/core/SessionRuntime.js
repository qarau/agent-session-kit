import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const VALID_TRANSITIONS = {
  created: ['active'],
  active: ['paused', 'blocked', 'closed'],
  paused: ['resumed', 'closed'],
  resumed: ['paused', 'blocked', 'closed'],
  blocked: ['resumed', 'closed'],
  closed: [],
};

function nowIso() {
  return new Date().toISOString();
}

function createSession(overrides = {}) {
  return {
    sessionId: `sess_${Date.now().toString(36)}`,
    status: 'created',
    branch: '',
    worktree: '',
    repoRoot: '',
    taskId: '',
    actorType: 'human',
    actorId: 'local',
    startedAt: '',
    lastActiveAt: '',
    closedAt: '',
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
    return this.transition('active', {
      reason: 'session started',
      sourceCommand: 'session start',
    });
  }

  async pause(reason, sourceCommand = 'session pause') {
    return this.transition('paused', { reason, sourceCommand });
  }

  async resume(reason, sourceCommand = 'session resume') {
    return this.transition('resumed', { reason, sourceCommand });
  }

  async block(reason, sourceCommand = 'session block') {
    return this.transition('blocked', { reason, sourceCommand });
  }

  async status() {
    const session = await this.getActiveSession();
    console.log(JSON.stringify(session, null, 2));
  }

  async close(reason, sourceCommand = 'session close') {
    return this.transition('closed', { reason, sourceCommand });
  }

  async getActiveSession() {
    return this.store.readJson(this.paths.activeSession(), createSession({ sessionId: '' }));
  }

  resolveState(session) {
    const status = session.status ?? '';
    if (!session.sessionId || status === '' || status === 'idle') {
      return 'created';
    }
    if (VALID_TRANSITIONS[status]) {
      return status;
    }
    return 'created';
  }

  async getGitContext() {
    const branch = await getGitValue(this.cwd, ['branch', '--show-current'], true);
    const repoRoot = await getGitValue(this.cwd, ['rev-parse', '--show-toplevel'], true);
    return {
      branch,
      repoRoot,
      worktree: repoRoot || this.cwd,
    };
  }

  projectSession(session, transition) {
    const status = transition.to === 'resumed' ? 'active' : transition.to;
    const next = {
      ...createSession({ sessionId: transition.sessionId }),
      ...session,
      sessionId: transition.sessionId,
      status,
      branch: transition.branch || session.branch,
      worktree: transition.worktree || session.worktree,
      repoRoot: transition.repoRoot || session.repoRoot,
      lastActiveAt: transition.at,
    };

    if (!next.startedAt) {
      next.startedAt = transition.at;
    }
    if (status === 'closed') {
      next.closedAt = transition.at;
    } else {
      next.closedAt = '';
    }

    return next;
  }

  async transition(to, options = {}) {
    const reason = options.reason ?? '';
    const sourceCommand = options.sourceCommand ?? `session ${to}`;
    const session = await this.getActiveSession();
    const from = this.resolveState(session);
    const allowed = VALID_TRANSITIONS[from] ?? [];

    if (!allowed.includes(to)) {
      return {
        ok: false,
        code: 'invalid-transition',
        from,
        to,
        allowed,
        message: `cannot transition from ${from} to ${to}`,
      };
    }

    const gitContext = await this.getGitContext();
    const sessionId = session.sessionId || createSession().sessionId;
    const transition = {
      sessionId,
      from,
      to,
      at: nowIso(),
      reason,
      actor: session.actorId || 'local',
      branch: gitContext.branch,
      worktree: gitContext.worktree,
      repoRoot: gitContext.repoRoot,
      sourceCommand,
    };

    await this.store.writeJson(this.paths.pendingTransition(), transition);
    await this.store.appendNdjson(this.paths.historyLog(), transition);
    const nextSession = this.projectSession(session, transition);
    await this.store.writeJson(this.paths.activeSession(), nextSession);
    await this.store.deleteFile(this.paths.pendingTransition());

    return {
      ok: true,
      session: nextSession,
      event: transition,
    };
  }
}
