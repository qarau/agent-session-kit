import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { Scaffolder } from '../fs/Scaffolder.js';
import { TaskRuntime } from './TaskRuntime.js';
import { VerificationRuntime } from './VerificationRuntime.js';
import { EvidenceRecorder } from './EvidenceRecorder.js';
import { SessionRuntime } from './SessionRuntime.js';
import { WorkContextEngine } from './WorkContextEngine.js';
import { PolicyEngine } from './PolicyEngine.js';
import { PrePushCheckEngine } from './PrePushCheckEngine.js';
import { RuntimeStateEngine } from './RuntimeStateEngine.js';
import { ArchitectRuntime } from './ArchitectRuntime.js';
import { evaluateCanCommitGate, evaluatePreflightGate } from './sessionPolicyGates.js';
import { normalizeBranchEnforcementMode, resolveBranchEnforcementMode } from './resolveBranchEnforcementMode.js';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { MetricsWriter } from './MetricsWriter.js';
import { RuntimeDriftAnalyticsEngine } from './RuntimeDriftAnalyticsEngine.js';
import { OhderEntropySnapshotEngine } from './OhderEntropySnapshotEngine.js';
import { AutonomousLoopStateMachine, AUTONOMOUS_LOOP_STEPS } from './AutonomousLoopStateMachine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalize(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function riskFromScore(score) {
  const value = toNumber(score, 100);
  if (value < 70) {
    return 'high';
  }
  if (value < 85) {
    return 'medium';
  }
  return 'low';
}

function entropyDimensionsFromArchitect(architect = {}) {
  const facts = architect?.ohderFacts && typeof architect.ohderFacts === 'object'
    ? architect.ohderFacts
    : {};
  const observabilityScore = architect?.architectureScore?.categories?.observability;
  return {
    ssotViolationCount: normalizeLower(facts.ssot_integrity) === 'invalid' ? 1 : 0,
    durabilityRisk: normalizeLower(architect?.durabilityAnalysis?.risk)
      || (normalizeLower(facts.durability_integrity) === 'at-risk' ? 'high' : 'low'),
    complexityRisk: normalizeLower(architect?.complexityAnalysis?.risk)
      || (normalizeLower(facts.srp_integrity) === 'weak' ? 'high' : 'low'),
    duplicationRisk: normalizeLower(architect?.duplicationAnalysis?.risk) || 'low',
    observabilityRisk: normalizeLower(architect?.observabilityAnalysis?.risk) || riskFromScore(observabilityScore),
    refactorHealth: normalizeLower(architect?.refactorOutcome?.status) || 'healthy',
  };
}

function parseList(value, fallback = [], lower = true) {
  const normalizeEntry = (entry) => {
    const resolved = normalize(entry);
    return lower ? resolved.toLowerCase() : resolved;
  };
  if (Array.isArray(value)) {
    return value.map(entry => normalizeEntry(entry)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(entry => normalizeEntry(entry)).filter(Boolean);
  }
  return [...fallback].map(entry => normalizeEntry(entry)).filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function renderTemplate(template, values = {}) {
  return String(template ?? '').replace(/\{([^}]+)\}/g, (_full, key) => normalize(values[key]));
}

function parseGitStatusPath(line) {
  const raw = String(line ?? '').trimEnd();
  if (!raw) {
    return '';
  }
  const pathStart = raw.length > 2 && raw[2] === ' ' ? 3 : 2;
  return raw.slice(pathStart).trim();
}

function resolveSummary({ taskId, lanes, fullSuiteResult }) {
  const laneText = lanes.length > 0 ? lanes.join(',') : 'default';
  if (fullSuiteResult.required) {
    return `slice close auto-verified after full suite pass for ${taskId}; lanes=${laneText}; command=${fullSuiteResult.command}`;
  }
  return `slice close auto-verified for ${taskId}; lanes=${laneText}; full-suite=not-required`;
}

export class SliceCloseRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.scaffolder = new Scaffolder(cwd);
    this.taskRuntime = new TaskRuntime(cwd);
    this.verificationRuntime = new VerificationRuntime(cwd);
    this.evidenceRecorder = new EvidenceRecorder(cwd);
    this.sessionRuntime = new SessionRuntime(cwd);
    this.contextEngine = new WorkContextEngine(cwd);
    this.policyEngine = new PolicyEngine(cwd);
    this.prePushCheckEngine = new PrePushCheckEngine(cwd);
    this.stateEngine = new RuntimeStateEngine(cwd);
    this.architectRuntime = new ArchitectRuntime(cwd);
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.metricsWriter = new MetricsWriter(cwd);
    this.driftAnalyticsEngine = new RuntimeDriftAnalyticsEngine();
    this.entropySnapshotEngine = new OhderEntropySnapshotEngine();
    this.loopStateMachine = new AutonomousLoopStateMachine(cwd);
  }

  runGit(args, allowFailure = false) {
    const result = spawnSync('git', args, {
      cwd: this.cwd,
      encoding: 'utf8',
    });
    const stdout = String(result.stdout ?? '');
    const stderr = String(result.stderr ?? '');
    if (result.status === 0) {
      return {
        ok: true,
        status: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    }
    if (allowFailure) {
      return {
        ok: false,
        status: Number(result.status ?? 1),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      };
    }
    throw new Error(`git ${args.join(' ')} failed: ${stderr || stdout}`.trim());
  }

  readContextConfig() {
    const configPath = path.join(this.cwd, 'docs', 'session', 'active-work-context.json');
    if (!fs.existsSync(configPath)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      return {};
    }
  }

  resolveBranchEnforcementMode(config = {}) {
    const modeFromEnv = normalizeBranchEnforcementMode(process.env.ASK_BRANCH_ENFORCEMENT_MODE);
    if (modeFromEnv) {
      return modeFromEnv;
    }
    const modeFromConfig = normalizeBranchEnforcementMode(config.branchEnforcementMode);
    if (modeFromConfig) {
      return modeFromConfig;
    }
    return 'protected';
  }

  async resolveLaneInputs(taskId, task, policy) {
    const lanes = new Set();
    const normalizedTaskId = normalize(taskId).toLowerCase();
    const normalizedTitle = normalize(task?.title).toLowerCase();

    if (normalizedTaskId.includes('release') || normalizedTitle.includes('release')) {
      lanes.add('release');
    }

    const queueClasses = await this.store.readJson(this.paths.queueClassesSnapshot(), { tasks: {} });
    const queueClass = normalize(queueClasses.tasks?.[taskId]?.latestClass).toLowerCase();
    if (queueClass) {
      lanes.add(queueClass);
    }

    const contextConfig = this.readContextConfig();
    const branchName = this.runGit(['branch', '--show-current'], true).stdout;
    const branchMode = this.resolveBranchEnforcementMode(contextConfig);
    if (resolveBranchEnforcementMode(branchName, branchMode) === 'enforce') {
      lanes.add('protected');
    }

    const requiredLanes = parseList(policy?.slice_close?.full_suite_required_lanes, [
      'release',
      'integrator',
      'protected',
    ]);
    const requiresFullSuite = requiredLanes.some(lane => lanes.has(lane));

    return {
      lanes: Array.from(lanes).sort(),
      requiredLanes,
      requiresFullSuite,
      queueClass,
      branchName,
      branchMode,
    };
  }

  runFullSuite(policy = {}) {
    const command = normalize(policy?.slice_close?.full_suite_command) || 'npm';
    const args = parseList(policy?.slice_close?.full_suite_args, ['test'], false);
    const result = spawnSync(command, args, {
      cwd: this.cwd,
      encoding: 'utf8',
      env: process.env,
    });
    return {
      command,
      args,
      status: Number(result.status ?? 1),
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      passed: result.status === 0,
    };
  }

  async markTestsPassed(source, checks = []) {
    const previous = await this.evidenceRecorder.readLatestChecks();
    await this.evidenceRecorder.writeLatestChecks({
      ...previous,
      testsPassed: true,
      checks: Array.isArray(previous.checks) ? Array.from(new Set([...previous.checks, ...checks])) : checks,
      source,
      updatedAt: nowIso(),
    });
    return this.evidenceRecorder.readLatestChecks();
  }

  buildCommitSubject(policy, taskId, task) {
    const template = normalize(policy?.slice_close?.commit_subject_template) || 'chore(slice): close {taskId}';
    return renderTemplate(template, {
      taskId,
      taskTitle: normalize(task?.title),
    });
  }

  resolveCommitFooterKey(policy) {
    return normalize(policy?.slice_commit?.footer_key) || 'ASK-Slice';
  }

  getStagedFiles() {
    const staged = this.runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMRT'], true);
    return staged.stdout ? staged.stdout.split('\n').map(normalize).filter(Boolean) : [];
  }

  evaluatePreStagedGuard(policy = {}) {
    if (toBoolean(policy?.slice_close?.allow_pre_staged_changes, false)) {
      return {
        ok: true,
        stagedFiles: [],
      };
    }

    const stagedFiles = this.getStagedFiles();
    if (stagedFiles.length > 0) {
      return fail('slice-close-dirty-index', 'slice close requires an empty git index before auto staging', {
        stagedFiles,
      });
    }

    return {
      ok: true,
      stagedFiles,
    };
  }

  getWorkspaceChangedFiles() {
    const status = this.runGit(['status', '--porcelain'], true);
    if (!status.ok && !status.stdout) {
      return [];
    }
    return status.stdout
      .split('\n')
      .map(line => line.trimEnd())
      .filter(Boolean)
      .map(parseGitStatusPath)
      .map(filePath => filePath.split(' -> ').at(-1))
      .map(filePath => normalize(filePath).replace(/\\/gu, '/'))
      .filter(Boolean)
      .filter(filePath => !filePath.startsWith('.ask/'));
  }

  resolveOhderValidation(fullSuiteResult, evidence = {}) {
    const checks = Array.isArray(evidence.checks) ? evidence.checks.map(normalize).filter(Boolean) : [];
    const testsRun = [];
    if (fullSuiteResult.required && fullSuiteResult.command) {
      testsRun.push(`${fullSuiteResult.command} ${Array.isArray(fullSuiteResult.args) ? fullSuiteResult.args.join(' ') : ''}`.trim());
    }
    testsRun.push(...checks);
    return {
      status: 'passed',
      testsRun: Array.from(new Set(testsRun)),
    };
  }

  async assessOhderBeforeClose(taskId, task, policy, fullSuiteResult, evidence) {
    const state = await this.stateEngine.hydrate(policy);
    const touchedFiles = this.getWorkspaceChangedFiles();
    const execution = {
      ...(state.latestExecution || {}),
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles,
      operation: `slice-close:${taskId}`,
      failOpenApplied: false,
    };
    const validation = {
      ...(state.latestValidation || {}),
      ...this.resolveOhderValidation(fullSuiteResult, evidence),
    };
    const slice = {
      id: taskId,
      title: normalize(task?.title),
      execution: {
        operation: `slice-close:${taskId}`,
      },
    };
    return this.architectRuntime.assess({
      state,
      slice,
      execution,
      validation,
      policy,
    });
  }

  async emitRuntimeEvent(type, session, taskId, payload = {}) {
    await this.ledger.append({
      type,
      sessionId: normalize(session?.sessionId),
      taskId: normalize(taskId),
      actor: normalize(session?.actorId) || 'local',
      payload,
      meta: {
        source: 'slice-close-runtime',
        schemaVersion: 1,
      },
    });
    await this.projectionEngine.projectIncremental();
  }

  async enterSliceCloseLoopStep(stepIndex, session, taskId, details = {}) {
    const stepName = AUTONOMOUS_LOOP_STEPS[stepIndex - 1] || '';
    const step = await this.loopStateMachine.enter(stepIndex, {
      source: 'slice-close',
      taskId,
      ...details,
    });
    await this.emitRuntimeEvent('AutonomousLoopStepEntered', session, taskId, {
      stepIndex,
      stepName,
      details: step.details || {},
      enteredAt: step.enteredAt,
    });
    return step;
  }

  buildArchitectEventPayload(taskId, architect) {
    return {
      taskId,
      sliceId: taskId,
      status: normalize(architect?.status),
      blocking: architect?.blocking === true,
      lawOutcome: normalize(architect?.lawOutcome),
      lawViolations: Array.isArray(architect?.lawViolations) ? architect.lawViolations : [],
      entropyDelta: Number(architect?.entropyDelta ?? 0) || 0,
      couplingDelta: Number(architect?.couplingDelta ?? 0) || 0,
      replayabilityRisk: normalize(architect?.replayabilityRisk),
    };
  }

  async emitArchitectReplayabilityEvents(session, taskId, architect) {
    const payload = this.buildArchitectEventPayload(taskId, architect);
    await this.emitRuntimeEvent('ArchitectValidationCompleted', session, taskId, payload);

    for (const violation of payload.lawViolations) {
      await this.emitRuntimeEvent('ArchitectureViolationDetected', session, taskId, {
        ...payload,
        violation,
        law: normalize(violation?.id),
        severity: normalize(violation?.severity),
        reason: normalize(violation?.message),
      });
    }

    const replayabilityRisk = normalize(architect?.replayabilityRisk).toLowerCase();
    if (architect?.blocking !== true && ['low', 'medium'].includes(replayabilityRisk)) {
      await this.emitRuntimeEvent('ReplayabilityValidated', session, taskId, {
        ...payload,
        valid: true,
      });
    }
  }

  async captureEntropyImpact(session, taskId, architect, policy = {}) {
    const previousAnalytics = await this.metricsWriter.readDriftAnalytics();
    const previousHistory = await this.metricsWriter.readHistory();
    const previousEntry = previousHistory.at(-1);
    const previousArchitect = previousEntry
      ? {
        architectureScore: {
          overallScore: toNumber(previousEntry.architectureScore, 0),
        },
      }
      : null;
    const entropy = this.entropySnapshotEngine.snapshot({
      architect,
      previousArchitect,
      driftAnalytics: previousAnalytics,
      policy,
    });
    const entropyDimensions = entropyDimensionsFromArchitect(architect);
    const historyEntry = {
      ts: entropy.measuredAt,
      source: 'slice-close',
      taskId,
      sliceId: taskId,
      validationStatus: 'passed',
      recoveryStatus: '',
      entropyDelta: toNumber(architect?.entropyDelta, 0),
      couplingDelta: toNumber(architect?.couplingDelta, 0),
      replayabilityRisk: normalize(architect?.replayabilityRisk),
      architectureScore: toNumber(architect?.architectureScore?.overallScore, 0),
      architectureScoreDelta: entropy.architectureScoreDelta,
      entropyScore: entropy.entropyScore,
      entropyTrend: entropy.trend,
      refactorPressure: entropy.refactorPressure,
      ...entropyDimensions,
      behaviorReplayConfidence: 1,
      protectedFlowViolations: 0,
      hardFlowViolations: 0,
    };
    await this.metricsWriter.appendHistory(historyEntry);
    const history = await this.metricsWriter.readHistory();
    const driftWindowSize = Math.max(1, Math.floor(toNumber(policy?.metrics?.drift_window_size, 10)));
    const analytics = this.driftAnalyticsEngine.compute(history, {
      windowSize: driftWindowSize,
    });
    const metrics = await this.metricsWriter.read();
    const nextMetrics = {
      ...metrics,
      architectureDriftScore: toNumber(analytics?.architecture?.driftScore, 0),
      behaviorDriftScore: toNumber(analytics?.behavior?.driftScore, 0),
      driftTrend: normalize(analytics?.overall?.trend) || 'stable',
      driftWindowSize: toNumber(analytics?.windowSize, 0),
      latestEntropy: entropy,
      latestEntropyDimensions: {
        ...entropyDimensions,
        ssotViolationTrend: analytics?.architecture?.ssotViolationTrend || 'stable',
        durabilityTrend: analytics?.architecture?.durabilityTrend || 'stable',
        complexityTrend: analytics?.architecture?.complexityTrend || 'stable',
        duplicationTrend: analytics?.architecture?.duplicationTrend || 'stable',
        observabilityTrend: analytics?.architecture?.observabilityTrend || 'stable',
        refactorHealthTrend: analytics?.architecture?.refactorHealthTrend || 'stable',
      },
      updatedAt: nowIso(),
    };
    await this.metricsWriter.write(nextMetrics);
    await this.metricsWriter.writeDriftAnalytics(analytics);

    await this.emitRuntimeEvent('EntropyImpactMeasured', session, taskId, {
      taskId,
      sliceId: taskId,
      entropy,
      history: historyEntry,
    });

    const previousTrend = normalize(previousAnalytics?.overall?.trend) || 'stable';
    const nextTrend = normalize(analytics?.overall?.trend) || 'stable';
    if (previousTrend !== nextTrend || previousHistory.length < 1) {
      await this.emitRuntimeEvent('EntropyTrendChanged', session, taskId, {
        taskId,
        sliceId: taskId,
        previousTrend,
        trend: nextTrend,
        entropy,
      });
    }

    return {
      entropy,
      history: historyEntry,
      driftAnalytics: analytics,
      metrics: nextMetrics,
    };
  }

  commitWithSliceFooter(taskId, policy, task) {
    const indexGuard = this.evaluatePreStagedGuard(policy);
    if (!indexGuard.ok) {
      return indexGuard;
    }

    const stage = this.runGit(['add', '-A'], true);
    if (!stage.ok) {
      return fail('git-add-failed', 'failed to stage workspace changes before commit', {
        stderr: stage.stderr,
      });
    }

    const stagedFiles = this.getStagedFiles();
    if (stagedFiles.length === 0) {
      return fail('no-staged-changes', 'no staged changes to commit for slice close');
    }

    const subject = this.buildCommitSubject(policy, taskId, task);
    const footerKey = this.resolveCommitFooterKey(policy);
    const footer = `${footerKey}: ${taskId}`;
    const retryOnce = toBoolean(policy?.slice_close?.retry_commit_once, true);
    const maxAttempts = retryOnce ? 2 : 1;

    let lastAttempt = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const commit = this.runGit(['commit', '-m', subject, '-m', footer], true);
      lastAttempt = {
        attempt,
        ...commit,
      };
      if (commit.ok) {
        const head = this.runGit(['rev-parse', 'HEAD'], true);
        return {
          ok: true,
          commit: {
            sha: normalize(head.stdout),
            subject,
            footer,
            stagedFiles,
            attempts: attempt,
          },
        };
      }
      this.runGit(['add', '-A'], true);
    }

    return fail('git-commit-failed', 'failed to create slice commit', {
      commitAttempt: lastAttempt,
      stagedFiles,
      subject,
      footer,
    });
  }

  async run(taskId) {
    await this.scaffolder.init();
    const resolvedTaskId = normalize(taskId);
    if (!resolvedTaskId) {
      return fail('missing-task-id', 'task id is required');
    }

    const task = await this.taskRuntime.getTask(resolvedTaskId);
    if (!task) {
      return fail('task-not-found', `task not found: ${resolvedTaskId}`, { taskId: resolvedTaskId });
    }
    if (normalize(task.status) !== 'in-progress') {
      return fail('invalid-task-state', `task must be in-progress to close: ${resolvedTaskId}`, {
        taskId: resolvedTaskId,
        status: normalize(task.status),
      });
    }

    const policy = await this.policyEngine.load();
    if (toBoolean(policy?.slice_close?.enabled, true) !== true) {
      return fail('slice-close-disabled', 'slice close runtime disabled by policy');
    }

    const session = await this.sessionRuntime.getActiveSession();
    const context = await this.contextEngine.getContext();
    const preflight = evaluatePreflightGate(policy, session, context);
    if (preflight.missing.length > 0) {
      return fail('slice-close-preflight-failed', 'slice close preflight checks failed', {
        missing: preflight.missing,
      });
    }
    await this.loopStateMachine.start(session.sessionId, {
      source: 'slice-close',
      taskId: resolvedTaskId,
      title: normalize(task.title),
    });
    await this.enterSliceCloseLoopStep(1, session, resolvedTaskId, {
      status: 'hydrated',
    });

    const laneInputs = await this.resolveLaneInputs(resolvedTaskId, task, policy);
    await this.enterSliceCloseLoopStep(3, session, resolvedTaskId, {
      lanes: laneInputs.lanes,
      requiresFullSuite: laneInputs.requiresFullSuite,
    });
    const fullSuiteResult = {
      required: laneInputs.requiresFullSuite,
      command: '',
      args: [],
      status: 0,
    };
    await this.enterSliceCloseLoopStep(8, session, resolvedTaskId, {
      required: laneInputs.requiresFullSuite,
    });
    if (laneInputs.requiresFullSuite) {
      const suite = this.runFullSuite(policy);
      fullSuiteResult.command = suite.command;
      fullSuiteResult.args = suite.args;
      fullSuiteResult.status = suite.status;
      if (!suite.passed) {
        return fail('full-suite-failed', 'full suite test command failed', {
          taskId: resolvedTaskId,
          lanes: laneInputs.lanes,
          command: suite.command,
          args: suite.args,
          status: suite.status,
          stdout: suite.stdout,
          stderr: suite.stderr,
        });
      }
      await this.markTestsPassed('slice-close-runtime:full-suite', ['full-suite']);
    }

    const evidence = await this.evidenceRecorder.readLatestChecks();
    const canCommit = evaluateCanCommitGate(policy, session, evidence);
    if (canCommit.missing.length > 0) {
      return fail('slice-close-can-commit-failed', 'slice close can-commit checks failed', {
        missing: canCommit.missing,
      });
    }

    const indexGuard = this.evaluatePreStagedGuard(policy);
    if (!indexGuard.ok) {
      return indexGuard;
    }

    const architect = await this.assessOhderBeforeClose(resolvedTaskId, task, policy, fullSuiteResult, evidence);
    await this.enterSliceCloseLoopStep(9, session, resolvedTaskId, {
      status: normalize(architect?.status),
      blocking: architect?.blocking === true,
    });
    await this.emitArchitectReplayabilityEvents(session, resolvedTaskId, architect);
    if (architect.blocking === true) {
      await this.enterSliceCloseLoopStep(16, session, resolvedTaskId, {
        decision: 'block',
        reason: normalize(architect?.reason),
      });
      await this.loopStateMachine.fail('block', {
        taskId: resolvedTaskId,
        reason: normalize(architect?.reason),
      });
      return fail('slice-close-ohder-blocked', 'OHDER architect governance blocked slice close', {
        taskId: resolvedTaskId,
        architect,
      });
    }
    const entropy = await this.captureEntropyImpact(session, resolvedTaskId, architect, policy);
    await this.enterSliceCloseLoopStep(10, session, resolvedTaskId, {
      refactorPressure: normalize(entropy?.entropy?.refactorPressure || entropy?.refactorPressure),
      trend: normalize(entropy?.entropy?.trend || entropy?.trend),
    });
    await this.enterSliceCloseLoopStep(11, session, resolvedTaskId, {
      triggered: false,
    });
    await this.enterSliceCloseLoopStep(12, session, resolvedTaskId, {
      validation: 'auto-verify',
    });

    const summary = resolveSummary({
      taskId: resolvedTaskId,
      lanes: laneInputs.lanes,
      fullSuiteResult,
    });
    const verified = await this.verificationRuntime.verify(resolvedTaskId, 'pass', summary);
    if (!verified.ok) {
      await this.enterSliceCloseLoopStep(16, session, resolvedTaskId, {
        decision: 'block',
        reason: 'verification failed',
      });
      await this.loopStateMachine.fail('block', {
        taskId: resolvedTaskId,
        reason: 'verification failed',
      });
      return fail('slice-close-verify-failed', 'failed to auto-verify task before close', {
        verification: verified,
      });
    }
    await this.enterSliceCloseLoopStep(13, session, resolvedTaskId, {
      verification: 'passed',
    });

    const completed = await this.taskRuntime.complete(resolvedTaskId);
    if (!completed.ok) {
      await this.enterSliceCloseLoopStep(16, session, resolvedTaskId, {
        decision: 'block',
        reason: 'task completion failed',
      });
      await this.loopStateMachine.fail('block', {
        taskId: resolvedTaskId,
        reason: 'task completion failed',
      });
      return fail('slice-close-complete-failed', 'failed to auto-complete task', {
        completion: completed,
      });
    }
    await this.enterSliceCloseLoopStep(14, session, resolvedTaskId, {
      checkpoint: 'task-completed',
    });
    await this.enterSliceCloseLoopStep(15, session, resolvedTaskId, {
      resumePacket: 'unchanged',
    });
    await this.enterSliceCloseLoopStep(16, session, resolvedTaskId, {
      decision: 'continue',
    });
    await this.loopStateMachine.complete('continue', {
      taskId: resolvedTaskId,
    });

    const committed = this.commitWithSliceFooter(resolvedTaskId, policy, task);
    if (!committed.ok) {
      await this.enterSliceCloseLoopStep(16, session, resolvedTaskId, {
        decision: 'retry',
        reason: normalize(committed.message),
      });
      await this.loopStateMachine.fail('retry', {
        taskId: resolvedTaskId,
        reason: normalize(committed.message),
      });
      const reopened = await this.taskRuntime.reopen(
        resolvedTaskId,
        `slice close rollback after commit failure: ${normalize(committed.message)}`
      );
      const blocked = await this.sessionRuntime.block(
        `slice close commit failed for ${resolvedTaskId}: ${normalize(committed.code)}`,
        'slice close commit failure'
      );
      return fail('slice-close-commit-failed', 'slice close commit failed and task was reopened', {
        taskId: resolvedTaskId,
        rollback: reopened,
        session: blocked,
        commitFailure: committed,
      });
    }

    const shouldRunPrePush = toBoolean(policy?.slice_close?.run_pre_push_check, true);
    if (shouldRunPrePush) {
      const prePush = await this.prePushCheckEngine.run();
      if (!prePush.passed) {
        await this.enterSliceCloseLoopStep(16, session, resolvedTaskId, {
          decision: 'block',
          reason: 'pre-push checks failed',
        });
        await this.loopStateMachine.fail('block', {
          taskId: resolvedTaskId,
          reason: 'pre-push checks failed',
        });
        const blocked = await this.sessionRuntime.block(
          `pre-push checks failed after slice close commit for ${resolvedTaskId}`,
          'slice close pre-push failure'
        );
        return fail('slice-close-pre-push-failed', 'commit succeeded but pre-push checks failed', {
          taskId: resolvedTaskId,
          commit: committed.commit,
          prePush,
          session: blocked,
        });
      }
      return {
        ok: true,
        taskId: resolvedTaskId,
        task: completed.task,
        commit: committed.commit,
        prePush,
        architect,
        entropy,
        lanes: laneInputs.lanes,
        fullSuite: fullSuiteResult,
      };
    }

    return {
      ok: true,
      taskId: resolvedTaskId,
      task: completed.task,
      commit: committed.commit,
      architect,
      entropy,
      lanes: laneInputs.lanes,
      fullSuite: fullSuiteResult,
    };
  }
}
