import fs from 'node:fs';
import path from 'node:path';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { TaskRuntime } from './TaskRuntime.js';
import { WorkflowRuntime } from './WorkflowRuntime.js';
import { PlanIngestRuntime } from './PlanIngestRuntime.js';

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

function toRelativeSlash(cwd, filePath) {
  const resolved = path.resolve(cwd, normalize(filePath));
  const relative = path.relative(cwd, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return normalize(filePath).replaceAll('\\', '/');
  }
  return relative.replaceAll('\\', '/');
}

function nowIso() {
  return new Date().toISOString();
}

export class PlanModeHandoffRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.tasks = new TaskRuntime(cwd);
    this.workflow = new WorkflowRuntime(cwd);
    this.planIngest = new PlanIngestRuntime(cwd);
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

  async appendHandoffEvent(type, taskId, payload) {
    const context = await this.sessionContext();
    await this.ledger.append({
      type,
      sessionId: context.sessionId,
      taskId,
      actor: context.actor,
      payload,
      meta: {
        source: 'plan-mode-handoff-runtime',
        schemaVersion: 1,
      },
    });
    await this.projectionEngine.projectIncremental();
  }

  async readState() {
    return this.store.readJson(path.join(this.paths.runtimeDir(), 'plan-mode-handoff.json'), {
      schemaVersion: 1,
      latest: null,
      handoffs: [],
    });
  }

  async writeState(record) {
    const state = await this.readState();
    const nextState = {
      schemaVersion: 1,
      latest: record,
      handoffs: [...(Array.isArray(state.handoffs) ? state.handoffs : []), record],
    };
    await this.store.writeJson(path.join(this.paths.runtimeDir(), 'plan-mode-handoff.json'), nextState);
    return nextState;
  }

  async ensureTask(taskId, title) {
    const existing = await this.tasks.getTask(taskId);
    if (existing) {
      return { ok: true, task: existing, created: false };
    }
    const created = await this.tasks.create(taskId, title, 'Plan Mode handoff source task');
    if (!created.ok) {
      return created;
    }
    return { ok: true, task: created.task, created: true };
  }

  validateInput(options) {
    const title = normalize(options.title);
    const sourceMarkdownPath = normalize(options.sourceMarkdownPath || options.source);
    const planJsonPath = normalize(options.planJsonPath || options.planJson);
    const taskId = normalize(options.taskId || options.task) || 'plan-mode-handoff';
    const runId = normalize(options.runId) || `plan-mode-${Date.now().toString(36)}`;
    const workflowName = normalize(options.workflow) || 'superpowers';
    const skill = normalize(options.skill) || 'writing-plans';

    if (!title) {
      return fail('missing-title', 'title is required');
    }
    if (!sourceMarkdownPath) {
      return fail('missing-source', 'source markdown path is required');
    }
    if (!planJsonPath) {
      return fail('missing-plan-json', 'plan JSON path is required');
    }

    const sourceAbsolutePath = path.resolve(this.cwd, sourceMarkdownPath);
    const planAbsolutePath = path.resolve(this.cwd, planJsonPath);
    if (!fs.existsSync(sourceAbsolutePath)) {
      return fail('source-not-found', `source markdown path does not exist: ${sourceMarkdownPath}`);
    }
    if (!fs.existsSync(planAbsolutePath)) {
      return fail('plan-json-not-found', `plan JSON path does not exist: ${planJsonPath}`);
    }

    return {
      ok: true,
      title,
      sourceMarkdownPath: toRelativeSlash(this.cwd, sourceMarkdownPath),
      planJsonPath: toRelativeSlash(this.cwd, planJsonPath),
      taskId,
      runId,
      workflowName,
      skill,
      forceNewBatch: options.forceNewBatch === true,
      dryRun: options.dryRun === true,
    };
  }

  async handoff(options = {}) {
    const input = this.validateInput(options);
    if (!input.ok) {
      return input;
    }

    const taskDecision = await this.ensureTask(input.taskId, input.title);
    if (!taskDecision.ok) {
      return taskDecision;
    }

    const started = await this.workflow.start(input.taskId, input.workflowName, input.skill, input.runId);
    if (!started.ok) {
      return started;
    }

    const markdownArtifact = await this.workflow.artifact(
      input.taskId,
      input.runId,
      'plan-markdown',
      input.sourceMarkdownPath,
      'Plan Mode source markdown'
    );
    if (!markdownArtifact.ok) {
      return markdownArtifact;
    }

    const planArtifact = await this.workflow.artifact(
      input.taskId,
      input.runId,
      'plan',
      input.planJsonPath,
      'Plan Mode structured ASK plan'
    );
    if (!planArtifact.ok) {
      return planArtifact;
    }

    const baseRecord = {
      status: 'created',
      title: input.title,
      taskId: input.taskId,
      runId: input.runId,
      workflow: input.workflowName,
      skill: input.skill,
      sourceMarkdownPath: input.sourceMarkdownPath,
      planJsonPath: input.planJsonPath,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    await this.appendHandoffEvent('PlanModeHandoffCreated', input.taskId, baseRecord);

    const validated = await this.planIngest.validate(input.taskId, input.runId, {
      path: input.planJsonPath,
      forceNewBatch: input.forceNewBatch,
    });
    if (!validated.ok) {
      const failedRecord = {
        ...baseRecord,
        status: 'validation-failed',
        error: {
          code: validated.code,
          message: validated.message,
        },
        updatedAt: nowIso(),
      };
      const state = await this.writeState(failedRecord);
      return {
        ok: false,
        code: validated.code,
        message: validated.message,
        ...validated,
        state: state.latest,
      };
    }

    await this.appendHandoffEvent('PlanModeHandoffValidated', input.taskId, {
      ...baseRecord,
      status: 'validated',
      planBatchId: validated.planBatchId,
      artifactHash: validated.artifactHash,
      sliceCount: validated.sliceCount,
    });

    const ingested = await this.planIngest.ingest(input.taskId, input.runId, {
      path: input.planJsonPath,
      forceNewBatch: input.forceNewBatch,
      dryRun: input.dryRun,
    });
    if (!ingested.ok) {
      const failedRecord = {
        ...baseRecord,
        status: 'ingest-failed',
        error: {
          code: ingested.code,
          message: ingested.message,
        },
        updatedAt: nowIso(),
      };
      const state = await this.writeState(failedRecord);
      return {
        ok: false,
        code: ingested.code,
        message: ingested.message,
        ...ingested,
        state: state.latest,
      };
    }

    const createdTaskIds = Array.isArray(ingested.createdTaskIds) ? ingested.createdTaskIds : [];
    const board = await this.tasks.readTaskBoard();
    const nextTaskId = createdTaskIds.find(taskId => board.tasks?.[taskId]?.status === 'created') || createdTaskIds[0] || '';
    const nextTask = nextTaskId ? board.tasks?.[nextTaskId] ?? { taskId: nextTaskId } : null;
    const record = {
      ...baseRecord,
      status: 'ingested',
      planBatchId: ingested.planBatchId,
      artifactHash: ingested.artifactHash,
      createdTaskIds,
      nextTaskId,
      updatedAt: nowIso(),
    };
    const state = await this.writeState(record);

    await this.appendHandoffEvent('PlanModeHandoffIngested', input.taskId, record);

    return {
      ok: true,
      taskId: input.taskId,
      runId: input.runId,
      planBatchId: ingested.planBatchId,
      artifactHash: ingested.artifactHash,
      createdTaskIds,
      nextTask,
      nextAction: nextTaskId ? `ask task start ${nextTaskId}` : 'ask next',
      state: state.latest,
    };
  }
}
