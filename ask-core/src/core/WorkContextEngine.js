import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';

const execFileAsync = promisify(execFile);

function nowIso() {
  return new Date().toISOString();
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

export class WorkContextEngine {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async verify() {
    const repoRoot = await getGitValue(this.cwd, ['rev-parse', '--show-toplevel'], true);
    const branch = await getGitValue(this.cwd, ['branch', '--show-current'], true);
    const context = {
      repoRoot,
      branch,
      worktree: this.cwd,
      verifiedAt: nowIso(),
    };
    await this.store.writeJson(this.paths.workContext(), context);
    const activeSession = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    await this.ledger.append({
      type: 'WorktreeVerified',
      sessionId: String(activeSession.sessionId || ''),
      actor: String(activeSession.actorId || 'local'),
      payload: context,
      meta: {
        source: 'work-context-engine',
      },
    });
    await this.projectionEngine.replay();
    console.log(JSON.stringify(context, null, 2));
  }

  async status() {
    const context = await this.getContext();
    console.log(JSON.stringify(context, null, 2));
  }

  async getContext() {
    return this.store.readJson(this.paths.workContext(), {
      repoRoot: '',
      branch: '',
      worktree: '',
      verifiedAt: '',
    });
  }
}
