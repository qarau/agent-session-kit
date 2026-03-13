import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { WorkflowRegistry } from '../adapters/WorkflowRegistry.js';
import { EvidenceRecorder } from './EvidenceRecorder.js';
import { PolicyEngine } from './PolicyEngine.js';

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

function defaultRunId() {
  return `run_${Date.now().toString(36)}`;
}

export class WorkflowRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.policyEngine = new PolicyEngine(cwd);
    this.evidenceRecorder = new EvidenceRecorder(cwd);
  }

  async readTaskBoard() {
    return this.store.readJson(this.paths.taskBoardSnapshot(), { tasks: {} });
  }

  async readWorkflowSnapshot() {
    return this.store.readJson(this.paths.workflowSnapshot(), { tasks: {} });
  }

  async getTask(taskId) {
    const board = await this.readTaskBoard();
    return board.tasks?.[normalize(taskId)] ?? null;
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

  async appendWorkflowEvent(type, taskId, payload = {}, meta = {}) {
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

  async registry() {
    const policy = await this.policyEngine.load();
    return new WorkflowRegistry({ policy });
  }

  async recommend(taskId, workflowName = 'superpowers') {
    const resolvedTaskId = normalize(taskId);
    const resolvedWorkflow = normalize(workflowName) || 'superpowers';
    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    const registry = await this.registry();
    const adapter = registry.get(resolvedWorkflow);
    if (!adapter) {
      return fail('workflow-not-found', `workflow adapter not found: ${resolvedWorkflow}`, {
        workflow: resolvedWorkflow,
      });
    }

    const verification = await this.evidenceRecorder.readTaskVerification(resolvedTaskId);
    let recommendation = null;
    try {
      recommendation = adapter.recommend({
        task,
        verification,
      });
    } catch (error) {
      return fail(
        String(error?.code ?? 'workflow-policy-rejected'),
        String(error?.message ?? 'workflow recommendation rejected by policy'),
        {
          workflow: resolvedWorkflow,
        }
      );
    }

    await this.appendWorkflowEvent(
      'WorkflowRecommended',
      resolvedTaskId,
      recommendation,
      { source: 'workflow-runtime' }
    );

    const snapshot = await this.readWorkflowSnapshot();
    return {
      ok: true,
      recommendation,
      workflow: snapshot.tasks?.[resolvedTaskId] ?? null,
    };
  }

  async providerStatus(workflowName = 'superpowers', version = '') {
    const resolvedWorkflow = normalize(workflowName) || 'superpowers';
    const resolvedVersion = normalize(version);
    const registry = await this.registry();
    const status = registry.providerStatus(resolvedWorkflow, resolvedVersion);
    if (!status) {
      return fail('workflow-not-found', `workflow adapter not found: ${resolvedWorkflow}`, {
        workflow: resolvedWorkflow,
      });
    }
    return status;
  }

  async start(taskId, workflowName, skill, runId = '') {
    const resolvedTaskId = normalize(taskId);
    const resolvedWorkflow = normalize(workflowName);
    const resolvedSkill = normalize(skill);
    const resolvedRunId = normalize(runId) || defaultRunId();

    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }
    if (!resolvedWorkflow) {
      return fail('missing-workflow', 'workflow is required');
    }
    if (!resolvedSkill) {
      return fail('missing-skill', 'skill is required');
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    await this.appendWorkflowEvent(
      'WorkflowRunStarted',
      resolvedTaskId,
      {
        workflow: resolvedWorkflow,
        skill: resolvedSkill,
        runId: resolvedRunId,
      },
      { source: 'workflow-runtime' }
    );

    const snapshot = await this.readWorkflowSnapshot();
    return {
      ok: true,
      runId: resolvedRunId,
      workflow: snapshot.tasks?.[resolvedTaskId] ?? null,
    };
  }

  async artifact(taskId, runId, type, filePath, summary = '') {
    const resolvedTaskId = normalize(taskId);
    const resolvedRunId = normalize(runId);
    const resolvedType = normalize(type);
    const resolvedPath = normalize(filePath);
    const resolvedSummary = normalize(summary);

    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }
    if (!resolvedRunId) {
      return fail('missing-run-id', 'run id is required');
    }
    if (!resolvedType) {
      return fail('missing-artifact-type', 'artifact type is required');
    }
    if (!resolvedPath) {
      return fail('missing-artifact-path', 'artifact path is required');
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    await this.appendWorkflowEvent(
      'WorkflowArtifactRecorded',
      resolvedTaskId,
      {
        runId: resolvedRunId,
        type: resolvedType,
        path: resolvedPath,
        summary: resolvedSummary,
      },
      { source: 'workflow-runtime' }
    );

    const snapshot = await this.readWorkflowSnapshot();
    return {
      ok: true,
      workflow: snapshot.tasks?.[resolvedTaskId] ?? null,
    };
  }

  async complete(taskId, runId, summary = '') {
    return this.finish(taskId, runId, summary, 'WorkflowRunCompleted');
  }

  async fail(taskId, runId, summary = '') {
    return this.finish(taskId, runId, summary, 'WorkflowRunFailed');
  }

  async finish(taskId, runId, summary, type) {
    const resolvedTaskId = normalize(taskId);
    const resolvedRunId = normalize(runId);
    const resolvedSummary = normalize(summary);

    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }
    if (!resolvedRunId) {
      return fail('missing-run-id', 'run id is required');
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    await this.appendWorkflowEvent(
      type,
      resolvedTaskId,
      {
        runId: resolvedRunId,
        summary: resolvedSummary,
      },
      { source: 'workflow-runtime' }
    );

    const snapshot = await this.readWorkflowSnapshot();
    return {
      ok: true,
      workflow: snapshot.tasks?.[resolvedTaskId] ?? null,
    };
  }
}
