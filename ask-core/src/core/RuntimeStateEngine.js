import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeSnapshotStore } from '../runtime/RuntimeSnapshotStore.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';

const execFileAsync = promisify(execFile);

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseMarker(line) {
  const markerPrefix = '<!-- codex-checkpoint --> ';
  if (!String(line).startsWith(markerPrefix)) {
    return null;
  }
  const rest = String(line).slice(markerPrefix.length).trim();
  const [at, operation, command, argsFingerprint, status, correlationId, failureCode] = rest.split(/\s+/u);
  return {
    at: normalize(at),
    operation: normalize(operation),
    command: normalize(command),
    argsFingerprint: normalize(argsFingerprint),
    status: normalize(status),
    correlationId: normalize(correlationId),
    failureCode: normalize(failureCode),
  };
}

export class RuntimeStateEngine {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.snapshotStore = new RuntimeSnapshotStore(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
  }

  async readDirtyWorktree() {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: this.cwd });
      const changed = String(stdout || '')
        .split(/\r?\n/u)
        .map(line => line.trimEnd())
        .filter(Boolean)
        .map(line => line.slice(3).trim())
        .map(pathValue => pathValue.split(' -> ').at(-1))
        .map(pathValue => normalize(pathValue))
        .filter(Boolean);
      const meaningful = changed.filter(pathValue => !pathValue.startsWith('.ask/'));
      return meaningful.length > 0;
    } catch {
      return false;
    }
  }

  readLatestByType(events, type) {
    const matches = events.filter(event => normalize(event.type) === type);
    if (matches.length < 1) {
      return null;
    }
    return matches[matches.length - 1];
  }

  readLatestValidation(events) {
    const matches = events.filter(event => normalize(event.type).startsWith('Validation'));
    if (matches.length < 1) {
      return null;
    }
    return matches[matches.length - 1];
  }

  readLatestTask(tasks = {}) {
    const entries = Object.values(tasks).filter(Boolean);
    if (entries.length < 1) {
      return null;
    }
    return entries
      .sort((left, right) => toNumber(left.lastEventSeq, 0) - toNumber(right.lastEventSeq, 0))
      .at(-1);
  }

  summarizeFailures(events, policy = {}) {
    const executionEvents = events.filter(event => normalize(event.type) === 'CodexExecutionCaptured');
    const failed = executionEvents.filter(event => {
      const status = normalize(event.payload?.status);
      return status === 'failed' || status === 'timeout' || status === 'blocked';
    });
    const byCode = new Map();
    for (const event of failed) {
      const code = normalize(event.payload?.failureCode) || 'unknown-runtime-error';
      byCode.set(code, (byCode.get(code) || 0) + 1);
    }
    const lastFailure = failed.at(-1);
    const lastFailureCode = normalize(lastFailure?.payload?.failureCode) || '';
    const sameFailureRepeats = lastFailureCode ? (byCode.get(lastFailureCode) || 0) : 0;
    const maxTotalFailuresPerSession = toNumber(policy?.retry?.max_total_failures_per_session, 5);
    const maxSameFailureRepeats = toNumber(policy?.retry?.max_same_failure_repeats, 2);

    return {
      totalFailures: failed.length,
      sameFailureRepeats,
      lastFailureCode,
      maxTotalFailuresPerSession,
      maxSameFailureRepeats,
      exceedsTotal: failed.length >= maxTotalFailuresPerSession,
      exceedsSameFailure: sameFailureRepeats >= maxSameFailureRepeats,
    };
  }

  resolveNextAction(nextActionsRaw) {
    const lines = String(nextActionsRaw ?? '')
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => !line.startsWith('#'));
    const marker = lines.map(parseMarker).filter(Boolean).at(-1);
    const humanNextAction = lines.filter(line => !line.startsWith('<!-- codex-checkpoint -->')).at(-1) || '';
    return {
      humanNextAction,
      marker,
      nextRecommendedAction: humanNextAction || marker?.operation || 'select next task',
    };
  }

  async hydrate(policy = {}) {
    await this.projectionEngine.projectIncremental();
    const events = await this.ledger.readAll();
    const projectionState = await this.snapshotStore.readProjectionState();
    const sessionSnapshot = await this.snapshotStore.readSession();
    const taskBoard = await this.snapshotStore.readTasks();
    const activeSession = await this.store.readJson(this.paths.activeSession(), { sessionId: '', status: 'idle' });
    const pendingTransitionExists = await this.store.exists(this.paths.pendingTransition());
    const nextActionsRaw = await this.store.readText(this.paths.nextActions(), '# Next Actions\n');
    const dirtyWorktree = await this.readDirtyWorktree();
    const nextAction = this.resolveNextAction(nextActionsRaw);
    const latestExecution = this.readLatestByType(events, 'CodexExecutionCaptured');
    const latestCheckpoint = this.readLatestByType(events, 'CodexGovernedCheckpointCreated');
    const latestValidation = this.readLatestValidation(events);
    const latestTask = this.readLatestTask(taskBoard?.tasks || {});
    const failureStats = this.summarizeFailures(events, policy);
    const eventCount = events.length;
    const lastSeq = eventCount > 0 ? toNumber(events.at(-1)?.seq, 0) : 0;
    const continuity = {
      projectionCursor: toNumber(projectionState.lastAppliedSeq, 0),
      eventCount,
      lastSeq,
      requiresReplay: projectionState.requiresReplay === true,
      cursorAheadOfLedger: toNumber(projectionState.lastAppliedSeq, 0) > lastSeq,
      sequenceGapDetected: toNumber(projectionState.lastAppliedSeq, 0) < lastSeq && eventCount > 0,
    };
    const continuityValid = !continuity.requiresReplay && !continuity.cursorAheadOfLedger;
    const checkpointMatchesExecution = Boolean(
      latestExecution &&
      latestCheckpoint &&
      normalize(latestExecution.payload?.correlationId) &&
      normalize(latestExecution.payload?.correlationId) === normalize(latestCheckpoint.payload?.correlationId)
    );

    return {
      sessionId: normalize(sessionSnapshot.sessionId || activeSession.sessionId),
      status: normalize(sessionSnapshot.status || activeSession.status || 'idle'),
      branch: normalize(sessionSnapshot.branch || activeSession.branch),
      worktree: normalize(sessionSnapshot.worktree || activeSession.worktree),
      goal: normalize(sessionSnapshot.goal),
      currentTask: normalize(latestTask?.title || latestTask?.taskId || ''),
      currentTaskId: normalize(latestTask?.taskId || ''),
      currentPhase: normalize(latestValidation?.type || latestExecution?.type || 'analysis'),
      completedTasks: Object.values(taskBoard?.tasks || {})
        .filter(task => normalize(task?.status) === 'completed')
        .map(task => normalize(task.taskId)),
      blockedTasks: Object.values(taskBoard?.tasks || {})
        .filter(task => normalize(task?.status) === 'blocked')
        .map(task => normalize(task.taskId)),
      latestExecution: latestExecution?.payload || null,
      latestCheckpoint: latestCheckpoint?.payload || null,
      latestValidation: latestValidation?.payload || null,
      dirtyWorktree,
      pendingTransitionExists,
      checkpointMatchesExecution,
      continuation: nextAction,
      nextRecommendedAction: nextAction.nextRecommendedAction,
      failureStats,
      continuity,
      continuityValid,
      acceptanceCriteriaMet: Object.values(taskBoard?.tasks || {}).length > 0 &&
        Object.values(taskBoard?.tasks || {}).every(task => normalize(task?.status) === 'completed'),
    };
  }
}
