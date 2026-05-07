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
import { ArchitectRuntime } from './ArchitectRuntime.js';
import { FlowRuntime } from './FlowRuntime.js';
import { AutonomousLoopStateMachine, AUTONOMOUS_LOOP_STEPS } from './AutonomousLoopStateMachine.js';
import { GovernanceDecisionWriter } from './GovernanceDecisionWriter.js';
import { RefactorGovernanceEngine } from './RefactorGovernanceEngine.js';

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
    this.architectRuntime = new ArchitectRuntime(cwd);
    this.flowRuntime = new FlowRuntime(cwd);
    this.loopStateMachine = new AutonomousLoopStateMachine(cwd);
    this.decisionWriter = new GovernanceDecisionWriter(cwd);
    this.refactorGovernanceEngine = new RefactorGovernanceEngine();
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

  async enterLoopStep(stepIndex, sessionId, actor, payload = {}) {
    const stepName = AUTONOMOUS_LOOP_STEPS[stepIndex - 1] || '';
    const step = await this.loopStateMachine.enter(stepIndex, payload);
    await this.emit('AutonomousLoopStepEntered', sessionId, actor, {
      stepIndex,
      stepName,
      payload,
      enteredAt: step.enteredAt,
    });
    return step;
  }

  async writeDecisionEnvelope({
    loopId,
    sessionId,
    slice,
    intent,
    recovery,
    validation,
    architect,
    flow,
  }) {
    const decision = recovery?.status || 'continue';
    const envelope = await this.decisionWriter.write({
      loopId,
      sessionId,
      sliceId: normalize(slice?.id),
      intentType: normalize(intent?.type),
      decision,
      reason: normalize(recovery?.reason),
      recoveryStatus: normalize(recovery?.status),
      validationStatus: normalize(validation?.status),
      architectStatus: normalize(architect?.status),
      flowStatus: normalize(flow?.status),
      blocking: decision === 'block',
    });
    return envelope;
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
    let lastArchitect = null;
    let lastFlow = null;
    let lastRecovery = null;
    let lastResumePacket = null;
    let lastDecisionEnvelope = null;

    const loopState = await this.loopStateMachine.start(sessionId, {
      mode: loopConfig.mode,
      maxSlices: loopConfig.maxSlices,
      until: loopConfig.until,
    });
    const loopId = normalize(loopState.loopId) || `loop_${randomUUID()}`;
    await this.emit('AutonomousLoopStarted', sessionId, actor, {
      loopId,
      mode: loopConfig.mode,
      maxSlices: loopConfig.maxSlices,
      until: loopConfig.until,
      startedAt: nowIso(),
    });

    for (let index = 0; index < loopConfig.maxSlices; index += 1) {
      await this.enterLoopStep(1, sessionId, actor, {
        sliceIndex: index + 1,
      });
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

      await this.enterLoopStep(2, sessionId, actor, {
        goal: normalize(hydrated.goal),
        currentTask: normalize(hydrated.currentTask),
      });
      await this.enterLoopStep(3, sessionId, actor, {
        continuityValid: hydrated.continuityValid === true,
        dirtyWorktree: hydrated.dirtyWorktree === true,
      });

      await this.enterLoopStep(4, sessionId, actor, {
        currentTask: normalize(hydrated.currentTask),
      });
      const intent = this.intentEngine.select(hydrated, policy);
      lastIntent = intent;
      await this.emit('IntentSelected', sessionId, actor, intent);

      const intentType = normalize(intent.type);
      if (intentType === 'request_human_input') {
        await this.enterLoopStep(16, sessionId, actor, {
          decision: 'block',
          reason: 'human-input-required',
        });
        lastDecisionEnvelope = await this.writeDecisionEnvelope({
          loopId,
          sessionId,
          intent,
          recovery: {
            status: 'block',
            reason: 'human-input-required',
          },
        });
        await this.loopStateMachine.complete('block', {
          reason: 'human-input-required',
        });
        return {
          ok: false,
          code: 'human-input-required',
          intent,
          governanceDecision: lastDecisionEnvelope,
        };
      }
      if (intentType === 'recover_pending_transition') {
        await this.sessionRuntime.getActiveSession();
        continue;
      }
      if (intentType === 'block') {
        await this.sessionRuntime.block(intent.reason || 'autonomous loop blocked', 'continue block');
        await this.enterLoopStep(16, sessionId, actor, {
          decision: 'block',
          reason: intent.reason,
        });
        lastDecisionEnvelope = await this.writeDecisionEnvelope({
          loopId,
          sessionId,
          intent,
          recovery: {
            status: 'block',
            reason: intent.reason || 'autonomous loop blocked',
          },
        });
        await this.emit('AutonomousLoopBlocked', sessionId, actor, {
          reason: intent.reason,
          intentType: intent.type,
        });
        await this.loopStateMachine.complete('block', {
          reason: intent.reason,
        });
        return {
          ok: false,
          code: 'autonomous-loop-blocked',
          intent,
          governanceDecision: lastDecisionEnvelope,
        };
      }
      if (intentType === 'close') {
        await this.sessionRuntime.close(intent.reason || 'autonomous loop complete', 'continue close');
        await this.enterLoopStep(16, sessionId, actor, {
          decision: 'close',
          reason: intent.reason,
        });
        lastDecisionEnvelope = await this.writeDecisionEnvelope({
          loopId,
          sessionId,
          intent,
          recovery: {
            status: 'close',
            reason: intent.reason || 'autonomous loop complete',
          },
        });
        await this.emit('AutonomousLoopCompleted', sessionId, actor, {
          reason: intent.reason,
          slicesRun,
          closedSession: true,
        });
        await this.loopStateMachine.complete('close', {
          reason: intent.reason,
        });
        return {
          ok: true,
          status: 'closed',
          slicesRun,
          intent,
          governanceDecision: lastDecisionEnvelope,
        };
      }

      await this.enterLoopStep(5, sessionId, actor, {
        intentType: normalize(intent.type),
      });
      const planned = this.slicePlanner.create(intent, hydrated, policy, {
        command: options.command,
        commandArgs: options.commandArgs,
        operation: options.operation || `autonomy-loop-${index + 1}`,
        allowedCommands: Array.isArray(options.allowedCommands) ? options.allowedCommands : [],
      });
      if (!planned.ok) {
        await this.sessionRuntime.block(planned.message, 'continue block');
        await this.enterLoopStep(16, sessionId, actor, {
          decision: 'block',
          reason: planned.message,
          code: planned.code,
        });
        lastDecisionEnvelope = await this.writeDecisionEnvelope({
          loopId,
          sessionId,
          intent,
          recovery: {
            status: 'block',
            reason: planned.message,
          },
        });
        await this.emit('AutonomousLoopBlocked', sessionId, actor, {
          reason: planned.message,
          code: planned.code,
        });
        await this.loopStateMachine.complete('block', {
          reason: planned.message,
          code: planned.code,
        });
        return {
          ok: false,
          code: planned.code,
          message: planned.message,
          governanceDecision: lastDecisionEnvelope,
        };
      }
      const slice = planned.slice;
      lastSlice = slice;
      slicesRun += 1;
      await this.emit('SliceCreated', sessionId, actor, slice);

      await this.enterLoopStep(6, sessionId, actor, {
        operation: normalize(slice.execution?.operation),
        command: normalize(slice.execution?.command),
      });
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
      await this.enterLoopStep(7, sessionId, actor, {
        executionStatus: normalize(latestExecution.status),
        exitCode: toNumber(latestExecution.exitCode, 1),
      });

      await this.enterLoopStep(8, sessionId, actor, {
        sliceId: slice.id,
      });
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

      await this.enterLoopStep(9, sessionId, actor, {
        validationStatus: normalize(validation.status),
      });
      const architect = await this.architectRuntime.assess({
        state: stateAfterExecution,
        slice,
        execution: {
          ...latestExecution,
          ok: launch.ok,
          failOpenApplied: launch.failOpenApplied === true,
        },
        validation,
        policy,
      });
      lastArchitect = architect;
      await this.emit('ArchitectValidationCompleted', sessionId, actor, architect);

      const flow = await this.flowRuntime.validate({
        slice,
        execution: {
          ...latestExecution,
          ok: launch.ok,
        },
        validation,
        policy,
      });
      lastFlow = flow;
      await this.emit('FlowValidationCompleted', sessionId, actor, flow);

      await this.enterLoopStep(10, sessionId, actor, {
        entropyDelta: toNumber(architect.entropyDelta, 0),
        couplingDelta: toNumber(architect.couplingDelta, 0),
        replayConfidence: toNumber(flow?.behaviorReplay?.confidence, 0),
      });
      const refactorGovernance = this.refactorGovernanceEngine.evaluate({
        architect,
        flow,
        policy,
        slice,
      });
      await this.enterLoopStep(11, sessionId, actor, {
        refactorGovernanceRequired: refactorGovernance.required === true,
        severity: normalize(refactorGovernance.severity),
      });
      await this.emit('RefactorGovernanceEvaluated', sessionId, actor, refactorGovernance);
      if (refactorGovernance.required) {
        await this.emit('RefactorGovernanceTriggered', sessionId, actor, {
          reason: refactorGovernance.reason,
          severity: refactorGovernance.severity,
          hint: refactorGovernance.hint,
        });
      }

      await this.enterLoopStep(12, sessionId, actor, {
        mode: 'refactor-governance-revalidation',
      });
      const refactorRevalidation = this.refactorGovernanceEngine.revalidate({
        architect,
        flow,
        trigger: refactorGovernance,
        policy,
      });
      await this.emit('RefactorGovernanceRevalidated', sessionId, actor, refactorRevalidation);
      await this.enterLoopStep(13, sessionId, actor, {
        validationStatus: normalize(validation.status),
        architectStatus: normalize(architect.status),
        flowStatus: normalize(flow.status),
        refactorGovernanceStatus: normalize(refactorRevalidation.status),
      });
      await this.emit('LoopLedgerUpdated', sessionId, actor, {
        sliceId: slice.id,
      });

      const recovery = this.failureRecovery.decide({
        state: stateAfterExecution,
        execution: latestExecution,
        validation,
        slice,
        policy,
      });
      let resolvedRecovery = recovery;
      const governanceBlocking = architect.blocking === true || flow.blocking === true;
      if (governanceBlocking) {
        const reasons = [architect.reason, flow.reason].filter(Boolean);
        resolvedRecovery = {
          status: 'block',
          failureType: 'governance-violation',
          reason: reasons.join('; ') || 'governance runtime blocked continuation',
          architect,
          flow,
        };
        await this.emit('GovernanceValidationBlocked', sessionId, actor, resolvedRecovery);
      }
      if (refactorGovernance.required && resolvedRecovery.status === 'continue' && policy?.refactor_governance?.auto_retry_on_trigger !== false) {
        resolvedRecovery = {
          status: 'retry',
          failureType: 'refactor-governance-triggered',
          reason: refactorGovernance.reason,
          recoverySliceHint: refactorGovernance.hint || {
            title: `Refactor Governance: ${slice.title}`,
            objective: 'Reduce entropy/coupling and revalidate behavior',
          },
          refactorGovernance,
          refactorRevalidation,
        };
      }
      if (refactorRevalidation.blocking === true) {
        resolvedRecovery = {
          status: 'block',
          failureType: 'refactor-governance-revalidation-failed',
          reason: refactorRevalidation.reason,
          refactorGovernance,
          refactorRevalidation,
        };
      }
      lastRecovery = resolvedRecovery;
      if (resolvedRecovery.failureType) {
        await this.emit('FailureClassified', sessionId, actor, resolvedRecovery);
      }
      if (resolvedRecovery.status === 'retry') {
        await this.emit('RecoverySliceCreated', sessionId, actor, {
          sliceId: slice.id,
          ...resolvedRecovery.recoverySliceHint,
        });
      }

      await this.enterLoopStep(14, sessionId, actor, {
        correlationId: normalize(latestExecution.correlationId),
      });
      await this.emit('LoopCheckpointGenerated', sessionId, actor, {
        correlationId: normalize(latestExecution.correlationId),
        sliceId: slice.id,
      });

      await this.enterLoopStep(15, sessionId, actor, {
        nextAction: resolvedRecovery.status === 'retry' ? 'Run recovery slice' : stateAfterExecution.nextRecommendedAction,
      });
      lastResumePacket = await this.resumePacketWriter.write({
        state: stateAfterExecution,
        intent,
        slice,
        execution: latestExecution,
        validation,
        architect,
        flow,
        nextAction: resolvedRecovery.status === 'retry' ? 'Run recovery slice' : stateAfterExecution.nextRecommendedAction,
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
        recovery: resolvedRecovery,
        resumePacket: lastResumePacket,
        architect,
        flow,
        policy,
      });
      await this.emit('RuntimeMetricsCaptured', sessionId, actor, metrics);

      await this.enterLoopStep(16, sessionId, actor, {
        decision: normalize(resolvedRecovery.status || 'continue'),
        reason: normalize(resolvedRecovery.reason),
      });
      lastDecisionEnvelope = await this.writeDecisionEnvelope({
        loopId,
        sessionId,
        slice,
        intent,
        recovery: resolvedRecovery,
        validation,
        architect,
        flow,
      });
      await this.emit('GovernanceDecisionWritten', sessionId, actor, lastDecisionEnvelope);

      if (resolvedRecovery.status === 'block') {
        await this.sessionRuntime.block(resolvedRecovery.reason, 'continue block');
        await this.emit('AutonomousLoopBlocked', sessionId, actor, resolvedRecovery);
        await this.loopStateMachine.complete('block', {
          reason: normalize(resolvedRecovery.reason),
        });
        return {
          ok: false,
          code: 'autonomous-loop-blocked',
          slicesRun,
          recovery: resolvedRecovery,
          validation,
          architect,
          flow,
          governanceDecision: lastDecisionEnvelope,
        };
      }

      if (loopConfig.until === 'complete' && normalize(intent.type) === 'close') {
        break;
      }
      if (loopConfig.mode === 'once' || options.once === true) {
        break;
      }
      if (loopConfig.until === 'blocked' && resolvedRecovery.status !== 'retry') {
        break;
      }
    }

    await this.emit('AutonomousLoopCompleted', sessionId, actor, {
      slicesRun,
      completedAt: nowIso(),
      intentType: normalize(lastIntent?.type),
      validationStatus: normalize(lastValidation?.status),
    });
    await this.loopStateMachine.complete('continue', {
      slicesRun,
      intentType: normalize(lastIntent?.type),
      validationStatus: normalize(lastValidation?.status),
    });

    return {
      ok: true,
      slicesRun,
      intent: lastIntent,
      slice: lastSlice,
      validation: lastValidation,
      architect: lastArchitect,
      flow: lastFlow,
      recovery: lastRecovery,
      resumePacket: lastResumePacket,
      governanceDecision: lastDecisionEnvelope,
    };
  }
}
