import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { EvidenceRecorder } from './EvidenceRecorder.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function resolveVerificationEventType(outcome) {
  if (outcome === 'pass') {
    return 'VerificationPassed';
  }
  if (outcome === 'fail') {
    return 'VerificationFailed';
  }
  return '';
}

export class VerificationRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.evidenceRecorder = new EvidenceRecorder(cwd);
  }

  async readTaskBoard() {
    return this.store.readJson(this.paths.taskBoardSnapshot(), { tasks: {} });
  }

  async getTask(taskId) {
    const board = await this.readTaskBoard();
    return board.tasks?.[normalize(taskId)] ?? null;
  }

  async getActiveSessionContext() {
    const session = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    return {
      sessionId: normalize(session.sessionId),
      actor: normalize(session.actorId) || 'local',
    };
  }

  async appendVerificationEvent(type, taskId, payload, meta = {}) {
    const context = await this.getActiveSessionContext();
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

  async attach(taskId, kind, filePath, summary = '') {
    const resolvedTaskId = normalize(taskId);
    const resolvedKind = normalize(kind);
    const resolvedPath = normalize(filePath);
    const resolvedSummary = normalize(summary);

    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }
    if (!resolvedKind) {
      return fail('missing-evidence-kind', 'evidence kind is required');
    }
    if (!resolvedPath) {
      return fail('missing-evidence-path', 'evidence path is required');
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    await this.appendVerificationEvent(
      'EvidenceAttached',
      resolvedTaskId,
      {
        kind: resolvedKind,
        path: resolvedPath,
        summary: resolvedSummary,
      },
      { source: 'verification-runtime' }
    );

    const verification = await this.evidenceRecorder.readTaskVerification(resolvedTaskId);
    return {
      ok: true,
      taskId: resolvedTaskId,
      verification,
    };
  }

  async verify(taskId, outcome, summary = '') {
    const resolvedTaskId = normalize(taskId);
    const resolvedOutcome = normalize(outcome);
    const resolvedSummary = normalize(summary);

    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }

    const type = resolveVerificationEventType(resolvedOutcome);
    if (!type) {
      return fail('invalid-verification-outcome', `unknown verification outcome: ${resolvedOutcome}`, {
        allowed: ['pass', 'fail'],
      });
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    await this.appendVerificationEvent(
      type,
      resolvedTaskId,
      {
        summary: resolvedSummary,
      },
      { source: 'verification-runtime' }
    );

    const verification = await this.evidenceRecorder.readTaskVerification(resolvedTaskId);
    return {
      ok: true,
      taskId: resolvedTaskId,
      verification,
    };
  }
}
