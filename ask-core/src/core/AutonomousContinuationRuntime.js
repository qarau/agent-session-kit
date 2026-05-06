import { randomUUID } from 'node:crypto';
import { Scaffolder } from '../fs/Scaffolder.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { PolicyEngine } from './PolicyEngine.js';
import { SessionRuntime } from './SessionRuntime.js';
import { RuntimeStateEngine } from './RuntimeStateEngine.js';
import { IntentEngine } from './IntentEngine.js';
import { SlicePlanner } from './SlicePlanner.js';
import { CodexLaunchRuntime } from './CodexLaunchRuntime.js';
import { ValidationIntelligenceEngine } from './ValidationIntelligenceEngine.js';
import { FailureRecoveryEngine } from './FailureRecoveryEngine.js';
import { ResumePacketWriter } from './ResumePacketWriter.js';
import { RuntimeMetricsEngine } from './RuntimeMetricsEngine.js';

function nowIso() {
  return new Date().toISOString();
}

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeStatus(value) {
  return normalize(value).toLowerCase();
}

function resolveValidationEventType(status) {
  if (status === 'passed') {
    return 'ValidationPassed';
  }
  if (status === 'warning') {
    return 'ValidationWarningRaised';
  }
  if (status === 'blocked') {
    return 'ValidationBlocked';
  }
  return 'ValidationFailed';
}

export class AutonomousContinuationRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.scaffolder = new Scaffolder(cwd);
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.policyEngine = new PolicyEngine(cwd);
    this.sessionRuntime = new SessionRuntime(cwd);
    this.stateEngine = new RuntimeStateEngine(cwd);
    this.intentEngine = new IntentEngine();
    this.slicePlanner = new SlicePlanner();
    this.codexLaunchRuntime = new CodexLaunchRuntime(cwd);
    this.validationEngine = new ValidationIntelligenceEngine(cwd);
    this.failureRecovery = new FailureRecoveryEngine();
    this.resumePacketWriter = new ResumePacketWriter(cwd);
    this.metricsEngine = new RuntimeMetricsEngine(cwd);
  }

  async emit(type, sessionId, actor, payload = {}, meta = {}) {
    await this.ledger.append({
      type,
      sessionId: normalize(sessionId),
      actor: normalize(actor) || 'local',
      payload,
      meta: {
        source: 'autonomous-continuation-runtime',
        schemaVersion: 1,
        ...meta,
      },
    });
    await this.projectionEngine.projectIncremental();
  }

  resolveLoopConfig(options = {}, policy = {}) {
    const defaultMode = normalize(policy?.autonomy?.default_mode || 'once');
    const explicitOnce = options.once === true;
    const until = normalize(options.until);
    const requestedMax = toNumber(options.maxSlices, 0);
    const policyMax = toNumber(policy?.autonomy?.max_slices_per_run, 1);
    let maxSlices = policyMax > 0 ? policyMax : 1;
    if (requestedMax > 0) {
      maxSlices = Math.min(requestedMax, Math.max(policyMax, requestedMax));
    }
    if (explicitOnce || defaultMode === 'once') {
      maxSlices = 1;
    }
    if (until === 'blocked' || until === 'complete') {
      maxSlices = Math.max(maxSlices, requestedMax || policyMax || 1);
    }
    return {
      maxSlices,
      until,
      mode: explicitOnce ? 'once' : defaultMode,
    };
  }

  async run(options = {}) {
    await this.scaffolder.init();
    const policy = await this.policyEngine.load();
    if (policy?.autonomy?.enabled === false) {
      return {
        ok: false,
        code: 'autonomy-disabled',
        message: 'autonomous continuation disabled by policy',
      };
    }

    const activeSession = await this.sessionRuntime.getActiveSession();
    const state = this.sessionRuntime.resolveState(activeSession);
    if (!['active', 'paused'].includes(state)) {
      return {
        ok: false,
        code: 'session-not-runnable',
        message: `session state ${state} is not runnable`,
      };
    }

    const sessionId = normalize(activeSession.sessionId);
    const actor = normalize(activeSession.actorId) || 'local';
    const loopConfig = this.resolveLoopConfig(options, policy);
    const startedAt = Date.now();
    let slicesRun = 0;
    let lastIntent = null;
    let lastSlice = null;
    let lastValidation = null;
    let lastRecovery = null;
    let lastResumePacket = null;

    await this.emit('AutonomousLoopStarted', sessionId, actor, {
      loopId: `loop_${randomUUID()}`,
      mode: loopConfig.mode,
      maxSlices: loopConfig.maxSlices,
      until: loopConfig.until,
      startedAt: nowIso(),
    });

    for (let index = 0; index < loopConfig.maxSlices; index += 1) {
      const hydrated = await this.stateEngine.hydrate(policy);
      await this.emit('ProjectionHydrated', sessionId, actor, {
        status: normalize(hydrated.status),
        currentTask: normalize(hydrated.currentTask),
        eventCount: toNumber(hydrated.continuity?.eventCount, 0),
      });
      await this.emit('ProjectionContinuityValidated', sessionId, actor, {
        valid: hydrated.continuityValid === true,
        continuity: hydrated.continuity,
      });

      const intent = this.intentEngine.select(hydrated, policy);
      lastIntent = intent;
      await this.emit('IntentSelected', sessionId, actor, intent);

      const intentType = normalize(intent.type);
      if (intentType === 'request_human_input') {
        return {
          ok: false,
          code: 'human-input-required',
          intent,
        };
      }
      if (intentType === 'recover_pending_transition') {
        await this.sessionRuntime.getActiveSession();
        continue;
      }
      if (intentType === 'block') {
        await this.sessionRuntime.block(intent.reason || 'autonomous loop blocked', 'continue block');
        await this.emit('AutonomousLoopBlocked', sessionId, actor, {
          reason: intent.reason,
          intentType: intent.type,
        });
        return {
          ok: false,
          code: 'autonomous-loop-blocked',
          intent,
        };
      }
      if (intentType === 'close') {
        await this.sessionRuntime.close(intent.reason || 'autonomous loop complete', 'continue close');
        await this.emit('AutonomousLoopCompleted', sessionId, actor, {
          reason: intent.reason,
          slicesRun,
          closedSession: true,
        });
        return {
          ok: true,
          status: 'closed',
          slicesRun,
          intent,
        };
      }

      const planned = this.slicePlanner.create(intent, hydrated, policy, {
        command: options.command,
        commandArgs: options.commandArgs,
        operation: options.operation || `autonomy-loop-${index + 1}`,
        allowedCommands: Array.isArray(options.allowedCommands) ? options.allowedCommands : [],
      });
      if (!planned.ok) {
        await this.sessionRuntime.block(planned.message, 'continue block');
        await this.emit('AutonomousLoopBlocked', sessionId, actor, {
          reason: planned.message,
          code: planned.code,
        });
        return {
          ok: false,
          code: planned.code,
          message: planned.message,
        };
      }
      const slice = planned.slice;
      lastSlice = slice;
      slicesRun += 1;
      await this.emit('SliceCreated', sessionId, actor, slice);

      const launch = await this.codexLaunchRuntime.launch({
        command: slice.execution.command,
        args: slice.execution.args,
        operation: slice.execution.operation,
        timeoutMs: toNumber(options.timeoutMs, 0),
        touchedFiles: slice.expectedTouchedFiles,
      });
      const stateAfterExecution = await this.stateEngine.hydrate(policy);
      const latestExecution = stateAfterExecution.latestExecution || {
        status: launch.ok ? 'completed' : 'failed',
        exitCode: launch.exitCode ?? 1,
        touchedFiles: [],
        failureCode: launch.code || '',
      };

      await this.emit('ValidationStarted', sessionId, actor, {
        sliceId: slice.id,
        correlationId: normalize(launch.correlationId || latestExecution.correlationId),
      });
      const validation = await this.validationEngine.validate({
        slice,
        execution: {
          ...latestExecution,
          ok: launch.ok,
          exitCode: launch.exitCode,
          failOpenApplied: launch.failOpenApplied === true,
          touchedFiles: latestExecution.touchedFiles || [],
        },
        policy,
      });
      lastValidation = validation;
      await this.emit(resolveValidationEventType(normalizeStatus(validation.status)), sessionId, actor, validation);

      const recovery = this.failureRecovery.decide({
        state: stateAfterExecution,
        execution: latestExecution,
        validation,
        slice,
        policy,
      });
      lastRecovery = recovery;
      if (recovery.failureType) {
        await this.emit('FailureClassified', sessionId, actor, recovery);
      }
      if (recovery.status === 'retry') {
        await this.emit('RecoverySliceCreated', sessionId, actor, {
          sliceId: slice.id,
          ...recovery.recoverySliceHint,
        });
      }

      lastResumePacket = await this.resumePacketWriter.write({
        state: stateAfterExecution,
        intent,
        slice,
        execution: latestExecution,
        validation,
        nextAction: recovery.status === 'retry' ? 'Run recovery slice' : stateAfterExecution.nextRecommendedAction,
        policy,
      });
      await this.emit('ResumePacketWritten', sessionId, actor, {
        nextAction: normalize(lastResumePacket.nextAction),
      });

      const metrics = await this.metricsEngine.capture({
        loopDurationMs: Date.now() - startedAt,
        execution: {
          ...latestExecution,
          failOpenApplied: launch.failOpenApplied === true,
        },
        validation,
        recovery,
        resumePacket: lastResumePacket,
      });
      await this.emit('RuntimeMetricsCaptured', sessionId, actor, metrics);

      if (recovery.status === 'block') {
        await this.sessionRuntime.block(recovery.reason, 'continue block');
        await this.emit('AutonomousLoopBlocked', sessionId, actor, recovery);
        return {
          ok: false,
          code: 'autonomous-loop-blocked',
          slicesRun,
          recovery,
          validation,
        };
      }

      if (loopConfig.until === 'complete' && normalize(intent.type) === 'close') {
        break;
      }
      if (loopConfig.mode === 'once' || options.once === true) {
        break;
      }
      if (loopConfig.until === 'blocked' && recovery.status !== 'retry') {
        break;
      }
    }

    await this.emit('AutonomousLoopCompleted', sessionId, actor, {
      slicesRun,
      completedAt: nowIso(),
      intentType: normalize(lastIntent?.type),
      validationStatus: normalize(lastValidation?.status),
    });

    return {
      ok: true,
      slicesRun,
      intent: lastIntent,
      slice: lastSlice,
      validation: lastValidation,
      recovery: lastRecovery,
      resumePacket: lastResumePacket,
    };
  }
}
