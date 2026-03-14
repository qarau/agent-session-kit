import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { IntegrationRuntime } from './IntegrationRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

export class AutoIntegrationRuntime {
  constructor(cwd, overrides = {}) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = overrides.ledger ?? new EventLedger(cwd);
    this.projectionEngine = overrides.projectionEngine ?? new RuntimeProjectionEngine(cwd);
    this.integrationRuntime = overrides.integrationRuntime ?? new IntegrationRuntime(cwd);
  }

  async getSessionContext() {
    const session = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    return {
      sessionId: normalize(session.sessionId),
      actor: normalize(session.actorId) || 'local',
    };
  }

  async appendEvent(type, taskId, payload = {}, meta = {}) {
    const context = await this.getSessionContext();
    await this.ledger.append({
      type,
      sessionId: context.sessionId,
      taskId: normalize(taskId),
      actor: context.actor,
      payload,
      meta,
    });
    await this.projectionEngine.replay();
  }

  async run(taskId, options = {}) {
    const result = await this.integrationRuntime.run(taskId, options);
    if (!result.taskId || !result.run?.runId) {
      return result;
    }

    const evidence = {
      kind: 'integration-run',
      path: `.ask/evidence/integration/${result.taskId}/${result.run.runId}.log`,
      summary: result.ok ? 'integration passed' : 'integration failed',
    };

    await this.appendEvent(
      'EvidenceAttached',
      result.taskId,
      {
        kind: evidence.kind,
        path: evidence.path,
        summary: evidence.summary,
      },
      { source: 'integration-auto-runtime' }
    );

    return {
      ...result,
      evidence,
    };
  }

  async status(taskId = '') {
    return this.integrationRuntime.status(taskId);
  }
}
