import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { IntegrationMergePlanner } from '../git/IntegrationMergePlanner.js';
import { IntegrationOrchestrator } from '../git/IntegrationOrchestrator.js';
import { IntegrationTempWorktreeManager } from '../git/IntegrationTempWorktreeManager.js';

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
  return `integration_${Date.now().toString(36)}`;
}

export class IntegrationRuntime {
  constructor(cwd, overrides = {}) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = overrides.ledger ?? new EventLedger(cwd);
    this.projectionEngine = overrides.projectionEngine ?? new RuntimeProjectionEngine(cwd);
    this.mergePlanner = overrides.mergePlanner ?? new IntegrationMergePlanner(cwd);
    this.orchestrator = overrides.orchestrator ?? new IntegrationOrchestrator();
    this.tempWorktreeManager = overrides.tempWorktreeManager ?? new IntegrationTempWorktreeManager(cwd);
  }

  async readTaskBoard() {
    return this.store.readJson(this.paths.taskBoardSnapshot(), { tasks: {} });
  }

  async readIntegrationSnapshot() {
    return this.store.readJson(this.paths.integrationSnapshot(), { tasks: {} });
  }

  async readMergeReadinessSnapshot() {
    return this.store.readJson(this.paths.mergeReadinessSnapshot(), { tasks: {} });
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

  async appendIntegrationEvent(type, taskId, payload = {}, meta = {}) {
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

  async plan(taskId, options = {}) {
    const resolvedTaskId = normalize(taskId);
    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    const plan = this.mergePlanner.plan({
      taskId: resolvedTaskId,
      runId: options.runId,
      baseBranch: options.baseBranch,
      headBranch: options.headBranch,
    });

    await this.appendIntegrationEvent(
      'IntegrationPlanCreated',
      resolvedTaskId,
      {
        runId: plan.runId,
        baseBranch: plan.baseBranch,
        headBranch: plan.headBranch,
        strategy: plan.strategy,
        plannedAt: plan.plannedAt,
      },
      { source: 'integration-runtime' }
    );

    const snapshot = await this.readIntegrationSnapshot();
    return {
      ok: true,
      plan,
      integration: snapshot.tasks?.[resolvedTaskId] ?? null,
    };
  }

  async run(taskId, options = {}) {
    const resolvedTaskId = normalize(taskId);
    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    const runId = normalize(options.runId) || defaultRunId();
    const command = normalize(options.command) || 'node -e "process.exit(0)"';

    const workspace = await this.tempWorktreeManager.provision(runId);

    await this.appendIntegrationEvent(
      'IntegrationRunStarted',
      resolvedTaskId,
      {
        runId,
        command,
        workspacePath: normalize(workspace.path),
      },
      { source: 'integration-runtime' }
    );

    const outcome = this.orchestrator.run(command, {
      cwd: workspace.path,
      env: process.env,
    });

    await this.appendIntegrationEvent(
      outcome.ok ? 'IntegrationRunPassed' : 'IntegrationRunFailed',
      resolvedTaskId,
      {
        runId,
        exitCode: outcome.exitCode,
        summary: outcome.ok ? 'integration command passed' : 'integration command failed',
      },
      { source: 'integration-runtime' }
    );

    await workspace.cleanup();

    const integration = await this.readIntegrationSnapshot();
    const mergeReadiness = await this.readMergeReadinessSnapshot();
    return {
      ok: outcome.ok,
      taskId: resolvedTaskId,
      run: {
        runId,
        status: outcome.ok ? 'passed' : 'failed',
        exitCode: outcome.exitCode,
        command,
      },
      integration: integration.tasks?.[resolvedTaskId] ?? null,
      mergeReadiness: mergeReadiness.tasks?.[resolvedTaskId] ?? {
        taskId: resolvedTaskId,
        status: 'revoked',
        reasonCode: 'integration-missing',
      },
    };
  }

  async status(taskId = '') {
    const resolvedTaskId = normalize(taskId);
    const integration = await this.readIntegrationSnapshot();
    const mergeReadiness = await this.readMergeReadinessSnapshot();

    if (!resolvedTaskId) {
      return {
        ok: true,
        integration: integration.tasks ?? {},
        mergeReadiness: mergeReadiness.tasks ?? {},
      };
    }

    const task = await this.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }

    return {
      ok: true,
      taskId: resolvedTaskId,
      integration: integration.tasks?.[resolvedTaskId] ?? {
        latestPlan: null,
        latestRun: null,
        runs: {},
      },
      mergeReadiness: mergeReadiness.tasks?.[resolvedTaskId] ?? {
        taskId: resolvedTaskId,
        status: 'revoked',
        reasonCode: 'integration-missing',
      },
    };
  }
}
