import { AskPaths } from './AskPaths.js';
import { FileStore } from './FileStore.js';
import { defaultPolicyYaml } from '../policy/defaultPolicy.js';

export class Scaffolder {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async init() {
    await this.store.ensureDir(this.paths.policyDir());
    await this.store.ensureDir(this.paths.sessionsDir());
    await this.store.ensureDir(this.paths.continuityDir());
    await this.store.ensureDir(this.paths.evidenceDir());
    await this.store.ensureDir(this.paths.handoffsDir());
    await this.store.ensureDir(this.paths.stateDir());
    await this.store.ensureDir(this.paths.runtimeDir());
    await this.store.ensureDir(this.paths.runtimeSnapshotsDir());
    await this.store.ensureDir(this.paths.tasksDir());
    await this.store.ensureDir(this.paths.worktreesDir());

    await this.store.ensureText(this.paths.runtimePolicy(), defaultPolicyYaml);
    await this.store.ensureText(this.paths.historyLog(), '');
    await this.store.ensureText(this.paths.runtimeEvents(), '');
    await this.store.writeJson(this.paths.sequenceState(), { nextSeq: 1 });
    await this.store.writeJson(this.paths.activeSession(), {
      sessionId: '',
      status: 'idle',
      branch: '',
      worktree: '',
      taskId: '',
      actorType: '',
      actorId: '',
      startedAt: '',
      lastActiveAt: '',
    });
    await this.store.ensureText(this.paths.currentStatus(), '# Current Status\n');
    await this.store.ensureText(this.paths.openLoops(), '# Open Loops\n');
    await this.store.ensureText(this.paths.nextActions(), '# Next Actions\n');
    await this.store.writeJson(this.paths.latestChecks(), {
      docsFresh: false,
      testsPassed: false,
      checks: [],
    });
    await this.store.ensureText(this.paths.latestHandoff(), '# Latest Handoff\n');
    await this.store.writeJson(this.paths.workContext(), {
      repoRoot: '',
      branch: '',
      worktree: '',
      verifiedAt: '',
    });
    await this.store.writeJson(this.paths.sessionSnapshot(), {
      sessionId: '',
      status: 'idle',
      goal: '',
      branch: '',
      worktree: '',
      startedAt: '',
      lastActiveAt: '',
      lastHandoffAt: '',
    });
    await this.store.writeJson(this.paths.taskBoardSnapshot(), { tasks: {} });
    await this.store.writeJson(this.paths.verificationSnapshot(), { tasks: {} });
    await this.store.writeJson(this.paths.workflowSnapshot(), { tasks: {} });
    await this.store.writeJson(this.paths.freshnessSnapshot(), { tasks: {} });
    await this.store.writeJson(this.paths.taskRegistry(), { tasks: {} });
  }
}
