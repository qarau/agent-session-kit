import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { TaskRuntime } from './TaskRuntime.js';
import { PlanModeHandoffRuntime } from './PlanModeHandoffRuntime.js';
import { GovernanceBypassFindingEngine } from './GovernanceBypassFindingEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function chooseActiveTask(tasks = []) {
  const active = tasks.filter(task => normalize(task.status).toLowerCase() === 'in-progress');
  if (active.length < 1) {
    return null;
  }
  return [...active].sort((left, right) => toNumber(right.lastEventSeq, 0) - toNumber(left.lastEventSeq, 0))[0];
}

function taskSummary(task) {
  if (!task) {
    return null;
  }
  return {
    taskId: normalize(task.taskId),
    title: normalize(task.title),
    status: normalize(task.status),
    lastEventSeq: toNumber(task.lastEventSeq, 0),
  };
}

export class ImplementationPreflightRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.tasks = new TaskRuntime(cwd);
    this.planModeHandoff = new PlanModeHandoffRuntime(cwd);
    this.bypassFindings = new GovernanceBypassFindingEngine(cwd);
  }

  async sessionContext() {
    const session = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    return {
      sessionId: normalize(session.sessionId),
      actor: normalize(session.actorId) || 'local',
    };
  }

  async appendPreflightEvent(payload) {
    const context = await this.sessionContext();
    await this.ledger.append({
      type: 'ImplementationPreflightChecked',
      sessionId: context.sessionId,
      taskId: normalize(payload.activeTask?.taskId),
      actor: context.actor,
      payload,
      meta: {
        source: 'implementation-preflight-runtime',
        schemaVersion: 1,
      },
    });
    await this.projectionEngine.projectIncremental();
  }

  recoveryForMissingHandoff() {
    return {
      type: 'implementation-begin',
      command: 'ask implementation begin --plan <md> --title <title>',
      reason: 'implementation requires ASK to prepare, ingest, and govern the plan before development starts',
    };
  }

  recoveryForMissingActiveSlice(handoff) {
    const nextTaskId = normalize(handoff?.nextTaskId)
      || (Array.isArray(handoff?.createdTaskIds) ? normalize(handoff.createdTaskIds[0]) : '');
    return {
      type: 'active-ask-slice',
      command: nextTaskId ? `ask task start ${nextTaskId}` : 'ask next',
      reason: 'implementation requires an in-progress ASK slice',
    };
  }

  async preflight(options = {}) {
    const advisory = options.advisory === true;
    const sliceCloseTaskId = normalize(options.sliceCloseTaskId);
    const handoffState = await this.planModeHandoff.readState();
    const handoff = handoffState.latest ?? null;
    const hasHandoff = normalize(handoff?.status).toLowerCase() === 'ingested';
    const taskStatus = await this.tasks.status();
    const taskMap = taskStatus?.ok ? taskStatus.tasks ?? {} : {};
    const activeTask = chooseActiveTask(Object.values(taskMap).filter(Boolean));
    const sliceCloseTask = sliceCloseTaskId ? taskMap[sliceCloseTaskId] ?? null : null;
    const createdTaskIds = Array.isArray(handoff?.createdTaskIds) ? handoff.createdTaskIds.map(normalize) : [];
    const sliceCloseAllowed = Boolean(
      sliceCloseTaskId
      && hasHandoff
      && sliceCloseTask
      && createdTaskIds.includes(sliceCloseTaskId)
      && ['in-progress', 'completed'].includes(normalize(sliceCloseTask.status).toLowerCase())
    );
    const missing = [];
    let recovery = null;

    if (!hasHandoff) {
      missing.push('plan-mode-handoff');
      recovery = this.recoveryForMissingHandoff();
    } else if (!activeTask && !sliceCloseAllowed) {
      missing.push('active-ask-slice');
      recovery = this.recoveryForMissingActiveSlice(handoff);
    }

    const passed = missing.length === 0;
    const payload = {
      ok: passed || advisory,
      passed,
      blocking: !passed && !advisory,
      advisory,
      code: passed || advisory ? '' : 'implementation-preflight-blocked',
      message: passed
        ? 'implementation preflight passed'
        : advisory
          ? 'implementation preflight advisory warnings present'
          : 'implementation preflight blocked',
      missing,
      recovery,
      handoff: hasHandoff
        ? {
          status: normalize(handoff.status),
          taskId: normalize(handoff.taskId),
          runId: normalize(handoff.runId),
          planBatchId: normalize(handoff.planBatchId),
          createdTaskIds: Array.isArray(handoff.createdTaskIds) ? [...handoff.createdTaskIds] : [],
          nextTaskId: normalize(handoff.nextTaskId),
        }
        : null,
      activeTask: taskSummary(activeTask),
      sliceCloseProvenance: sliceCloseAllowed
        ? {
          taskId: sliceCloseTaskId,
          status: normalize(sliceCloseTask.status),
          source: 'ASK_SLICE_CLOSE_TASK_ID',
        }
        : null,
    };

    let findings = [];
    if (!passed && !advisory) {
      const findingResult = await this.bypassFindings.report({
        taskId: normalize(activeTask?.taskId),
        bypassType: missing.includes('plan-mode-handoff') ? 'missing plan-mode handoff' : 'missing active ask slice',
        severity: 'critical',
        message: normalize(recovery?.reason) || 'implementation governance bypass detected',
        evidence: missing.map(item => ({ reason: item })),
        recommendations: recovery?.command ? [recovery.command] : [],
      });
      findings = Array.isArray(findingResult.findings) ? findingResult.findings : [];
    }

    await this.appendPreflightEvent(payload);
    return {
      ...payload,
      findings,
    };
  }
}
