import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { Scaffolder } from '../fs/Scaffolder.js';
import { SessionRuntime } from './SessionRuntime.js';
import { WorkContextEngine } from './WorkContextEngine.js';
import { PolicyEngine } from './PolicyEngine.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { RuntimeSnapshotStore } from '../runtime/RuntimeSnapshotStore.js';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { evaluatePreflightGate } from './sessionPolicyGates.js';

const execFileAsync = promisify(execFile);

function nowIso() {
  return new Date().toISOString();
}

function createArgsFingerprint(args = []) {
  return createHash('sha256').update(JSON.stringify(args)).digest('hex');
}

function normalize(value) {
  return String(value ?? '').trim();
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function normalizeStatus(exitCode, blocked = false, timedOut = false) {
  if (blocked) {
    return 'blocked';
  }
  if (timedOut) {
    return 'timeout';
  }
  if (exitCode === 0) {
    return 'completed';
  }
  return 'failed';
}

export class CodexLaunchRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.scaffolder = new Scaffolder(cwd);
    this.sessionRuntime = new SessionRuntime(cwd);
    this.contextEngine = new WorkContextEngine(cwd);
    this.policyEngine = new PolicyEngine(cwd);
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.snapshotStore = new RuntimeSnapshotStore(cwd);
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async ensureSessionReady() {
    const session = await this.sessionRuntime.getActiveSession();
    const state = this.sessionRuntime.resolveState(session);
    if (state === 'active') {
      return await this.sessionRuntime.getActiveSession();
    }
    if (state === 'created') {
      const started = await this.sessionRuntime.start();
      if (!started.ok) {
        return null;
      }
      return started.session;
    }
    if (state === 'paused' || state === 'blocked') {
      const resumed = await this.sessionRuntime.resume('codex governed launch', 'codex launch resume');
      if (!resumed.ok) {
        return null;
      }
      return resumed.session;
    }
    return null;
  }

  async emitEvent(type, sessionId, actor, payload, meta = {}) {
    await this.ledger.append({
      type,
      sessionId,
      actor,
      payload,
      meta: {
        source: 'codex-launch-runtime',
        schemaVersion: 1,
        ...meta,
      },
    });
    await this.projectionEngine.projectIncremental();
  }

  async listChangedFiles() {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: this.cwd });
      return String(stdout || '')
        .split(/\r?\n/u)
        .map(line => line.trimEnd())
        .filter(Boolean)
        .map(line => {
          const rawPath = line.slice(3).trim();
          if (!rawPath) {
            return '';
          }
          const renameParts = rawPath.split(' -> ');
          return renameParts[renameParts.length - 1].trim();
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  mergeTouchedFiles(explicitTouched = [], beforeTouched = [], afterTouched = []) {
    const touched = new Set();
    const before = new Set(beforeTouched.map(value => normalize(value)).filter(Boolean));
    for (const file of explicitTouched) {
      const normalized = normalize(file);
      if (normalized) {
        touched.add(normalized);
      }
    }
    for (const file of afterTouched) {
      const normalized = normalize(file);
      if (normalized && !before.has(normalized)) {
        touched.add(normalized);
      }
    }
    return Array.from(touched).sort();
  }

  runCommand(command, args = [], timeoutMs = 0) {
    return new Promise(resolve => {
      let settled = false;
      let timedOut = false;
      const child = spawn(command, args, {
        cwd: this.cwd,
        stdio: 'inherit',
        env: process.env,
      });

      const resolveOnce = payload => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(payload);
      };

      const timer = timeoutMs > 0
        ? setTimeout(() => {
          timedOut = true;
          try {
            child.kill();
          } catch {
            // no-op
          }
        }, timeoutMs)
        : null;

      child.on('error', error => {
        if (timer) {
          clearTimeout(timer);
        }
        resolveOnce({
          exitCode: 1,
          failureCode: 'spawn-error',
          errorMessage: String(error?.message ?? 'spawn failed'),
          timedOut: false,
        });
      });

      child.on('close', code => {
        if (timer) {
          clearTimeout(timer);
        }
        const exitCode = Number.isFinite(code) ? Number(code) : 1;
        if (timedOut) {
          resolveOnce({
            exitCode: 124,
            failureCode: 'command-timeout',
            errorMessage: `command timed out after ${String(timeoutMs)}ms`,
            timedOut: true,
          });
          return;
        }
        resolveOnce({
          exitCode,
          failureCode: exitCode === 0 ? '' : 'command-exit-nonzero',
          errorMessage: '',
          timedOut: false,
        });
      });
    });
  }

  async verifyProjectionContinuity() {
    await this.projectionEngine.projectIncremental();
    const projectionState = await this.snapshotStore.readProjectionState();
    const sequenceState = await this.store.readJson(this.paths.sequenceState(), { nextSeq: 1 });
    const nextSeq = Math.max(1, Number(sequenceState.nextSeq) || 1);
    const lastAppliedSeq = Math.max(0, Number(projectionState.lastAppliedSeq) || 0);
    const lastEventSeq = nextSeq - 1;
    const valid = lastAppliedSeq <= lastEventSeq && projectionState.requiresReplay !== true;
    return {
      ok: valid,
      lastAppliedSeq,
      lastEventSeq,
      requiresReplay: projectionState.requiresReplay === true,
    };
  }

  async persistCheckpointContinuity({
    operation,
    command,
    args,
    status,
    correlationId,
    endedAtIso,
    failureCode,
  }) {
    const nextActionsPath = this.paths.nextActions();
    const existing = await this.store.readText(nextActionsPath, '# Next Actions\n');
    const lines = existing.trimEnd().split(/\r?\n/u);
    const marker = '<!-- codex-checkpoint -->';
    const filtered = lines.filter(line => !line.startsWith(`${marker} `));
    const summary = [
      marker,
      endedAtIso,
      operation,
      command,
      createArgsFingerprint(args),
      status,
      correlationId,
      failureCode || '',
    ].join(' ');
    filtered.push(summary);
    await this.store.writeText(nextActionsPath, `${filtered.join('\n')}\n`);
  }

  async resolveRunnableSession() {
    await this.scaffolder.init();
    const session = await this.ensureSessionReady();
    if (!session || !session.sessionId) {
      return null;
    }
    return session;
  }

  resolveReasonMinLength(policy = {}, key, fallback = 10) {
    const configured = policy?.codex_runtime?.[key];
    return toPositiveInt(configured, fallback);
  }

  validateOverrideGovernance({
    mode,
    policy,
    reason,
    approvedBy,
    approvalTicket,
    reasonKey,
    reasonLengthKey,
    requireReasonKey,
    requireApprovalKey,
    requireTicketKey,
  }) {
    const normalizedReason = normalize(reason);
    const normalizedApprovedBy = normalize(approvedBy);
    const normalizedTicket = normalize(approvalTicket);
    const minReasonLength = this.resolveReasonMinLength(policy, reasonLengthKey, 10);
    const requireReason = policy?.codex_runtime?.[requireReasonKey] !== false;
    const requireApproval = policy?.codex_runtime?.[requireApprovalKey] === true;
    const requireTicket = policy?.codex_runtime?.[requireTicketKey] === true;

    if (requireReason && normalizedReason.length < minReasonLength) {
      return {
        ok: false,
        code: 'override-governance-invalid',
        message: `${reasonKey} must be at least ${String(minReasonLength)} characters`,
      };
    }
    if (requireApproval && !normalizedApprovedBy) {
      return {
        ok: false,
        code: 'override-governance-invalid',
        message: 'override approval metadata is required by policy',
      };
    }
    if (requireTicket && !normalizedTicket) {
      return {
        ok: false,
        code: 'override-governance-invalid',
        message: 'override approval ticket is required by policy',
      };
    }

    return {
      ok: true,
      mode,
      reason: normalizedReason,
      approvedBy: normalizedApprovedBy,
      approvalTicket: normalizedTicket,
      minReasonLength,
      requireReason,
      requireApproval,
      requireTicket,
    };
  }

  buildExecutionPayload({
    correlationId,
    operation,
    command,
    args,
    status,
    exitCode,
    durationMs,
    startedAt,
    endedAt,
    touchedFiles,
    failureCode = '',
    extra = {},
  }) {
    return {
      correlationId,
      operation,
      command,
      argsFingerprint: createArgsFingerprint(args),
      status,
      exitCode,
      durationMs,
      startedAt,
      endedAt,
      touchedFiles,
      failureCode,
      ...extra,
    };
  }

  async launch(options = {}) {
    const command = String(options.command || 'codex');
    const args = Array.isArray(options.args) ? options.args : [];
    const touchedFiles = Array.isArray(options.touchedFiles) ? options.touchedFiles : [];
    const operation = String(options.operation || 'codex-launch');
    const timeoutMs = toPositiveInt(options.timeoutMs, 0);
    const failOpenRequested = options.allowFailOpen === true;
    const failOpenReason = normalize(options.failOpenReason);
    const failOpenApprovedBy = normalize(options.overrideApprovedBy);
    const failOpenApprovalTicket = normalize(options.overrideApprovalTicket);

    const session = await this.resolveRunnableSession();
    if (!session) {
      return {
        ok: false,
        code: 'session-not-runnable',
        message: 'unable to enter runnable session state for codex launch',
      };
    }

    const context = await this.contextEngine.verifyQuiet();
    const policy = await this.policyEngine.load();
    const gate = evaluatePreflightGate(policy, session, context);
    const allowFailOpen = policy?.codex_runtime?.allow_fail_open_launch === true;
    const blocked = gate.missing.length > 0;
    const actor = String(session.actorId || 'local');
    const sessionId = String(session.sessionId || '');
    const projectionContinuity = await this.verifyProjectionContinuity();
    if (!projectionContinuity.ok) {
      const blockedAt = nowIso();
      await this.emitEvent('CodexGovernedLaunchBlocked', sessionId, actor, this.buildExecutionPayload({
        correlationId: randomUUID(),
        operation,
        command,
        args,
        status: 'blocked',
        exitCode: 1,
        durationMs: 0,
        startedAt: blockedAt,
        endedAt: blockedAt,
        touchedFiles,
        failureCode: 'projection-continuity-invalid',
        extra: {
          continuity: projectionContinuity,
        },
      }));
      return {
        ok: false,
        code: 'projection-continuity-invalid',
        continuity: projectionContinuity,
      };
    }

    if (blocked && !(failOpenRequested && allowFailOpen)) {
      const blockedAt = nowIso();
      await this.emitEvent('CodexGovernedLaunchBlocked', sessionId, actor, this.buildExecutionPayload({
        correlationId: randomUUID(),
        operation,
        command,
        args,
        status: normalizeStatus(1, true),
        exitCode: 1,
        durationMs: 0,
        startedAt: blockedAt,
        endedAt: blockedAt,
        touchedFiles,
        failureCode: 'preflight-failed',
        extra: {
          missing: gate.missing,
        },
      }));
      return {
        ok: false,
        code: 'preflight-failed',
        missing: gate.missing,
      };
    }

    if (blocked && failOpenRequested) {
      const governance = this.validateOverrideGovernance({
        mode: 'fail-open',
        policy,
        reason: failOpenReason,
        approvedBy: failOpenApprovedBy,
        approvalTicket: failOpenApprovalTicket,
        reasonKey: 'fail-open reason',
        reasonLengthKey: 'fail_open_reason_min_length',
        requireReasonKey: 'require_fail_open_reason',
        requireApprovalKey: 'require_fail_open_approval',
        requireTicketKey: 'require_fail_open_approval_ticket',
      });
      if (!governance.ok) {
        await this.emitEvent('CodexGovernedLaunchBlocked', sessionId, actor, this.buildExecutionPayload({
          correlationId: randomUUID(),
          operation,
          command,
          args,
          status: 'blocked',
          exitCode: 1,
          durationMs: 0,
          startedAt: nowIso(),
          endedAt: nowIso(),
          touchedFiles,
          failureCode: governance.code,
          extra: {
            message: governance.message,
          },
        }));
        return governance;
      }

      await this.emitEvent('CodexLaunchFailOpenOverrideLogged', sessionId, actor, this.buildExecutionPayload({
        correlationId: randomUUID(),
        operation,
        command,
        args,
        status: 'completed',
        exitCode: 0,
        durationMs: 0,
        startedAt: nowIso(),
        endedAt: nowIso(),
        touchedFiles: [],
        failureCode: '',
        extra: {
          reason: governance.reason,
          approvedBy: governance.approvedBy,
          approvalTicket: governance.approvalTicket,
        },
      }));
    }

    const correlationId = randomUUID();
    const startedAt = Date.now();
    const startedAtIso = nowIso();
    const changedFilesBefore = await this.listChangedFiles();
    await this.emitEvent('CodexGovernedLaunchStarted', sessionId, actor, this.buildExecutionPayload({
      correlationId,
      operation,
      command,
      args,
      status: 'completed',
      exitCode: 0,
      durationMs: 0,
      startedAt: startedAtIso,
      endedAt: startedAtIso,
      touchedFiles: [],
      failureCode: '',
      extra: {
        preflightMissing: gate.missing,
        failOpen: blocked && failOpenRequested,
        failOpenReason: blocked && failOpenRequested ? failOpenReason : '',
        projectionContinuity,
      },
    }));

    const result = await this.runCommand(command, args, timeoutMs);
    const endedAt = Date.now();
    const endedAtIso = nowIso();
    const durationMs = endedAt - startedAt;
    const status = normalizeStatus(result.exitCode, false, result.timedOut === true);
    const changedFilesAfter = await this.listChangedFiles();
    const resolvedTouchedFiles = this.mergeTouchedFiles(touchedFiles, changedFilesBefore, changedFilesAfter);

    await this.emitEvent('CodexExecutionCaptured', sessionId, actor, this.buildExecutionPayload({
      correlationId,
      operation,
      command,
      args,
      status,
      exitCode: result.exitCode,
      durationMs,
      startedAt: startedAtIso,
      endedAt: endedAtIso,
      touchedFiles: resolvedTouchedFiles,
      failureCode: result.failureCode || '',
      extra: {
        errorMessage: result.errorMessage || '',
      },
    }));

    await this.emitEvent('CodexGovernedCheckpointCreated', sessionId, actor, this.buildExecutionPayload({
      correlationId,
      operation,
      command,
      args,
      status: 'completed',
      exitCode: 0,
      durationMs: 0,
      startedAt: endedAtIso,
      endedAt: endedAtIso,
      touchedFiles: [],
      failureCode: '',
      extra: {
        checkpointAt: endedAtIso,
      },
    }));
    await this.persistCheckpointContinuity({
      operation,
      command,
      args,
      status,
      correlationId,
      endedAtIso,
      failureCode: result.failureCode || '',
    });

    return {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      correlationId,
      blockedByPreflight: blocked,
      preflightMissing: gate.missing,
      failOpenApplied: blocked && failOpenRequested,
    };
  }

  async checkpoint(options = {}) {
    const operation = String(options.operation || 'codex-interactive-checkpoint');
    const touchedFiles = Array.isArray(options.touchedFiles) ? options.touchedFiles : [];
    const session = await this.resolveRunnableSession();
    if (!session) {
      return {
        ok: false,
        code: 'session-not-runnable',
        message: 'unable to enter runnable session state for codex checkpoint',
      };
    }
    await this.contextEngine.verifyQuiet();
    const sessionId = String(session.sessionId || '');
    const actor = String(session.actorId || 'local');
    const checkpointAt = nowIso();
    const correlationId = randomUUID();
    const changedFiles = touchedFiles.length > 0 ? touchedFiles : await this.listChangedFiles();

    await this.emitEvent('CodexInteractiveCheckpointCreated', sessionId, actor, this.buildExecutionPayload({
      correlationId,
      operation,
      command: 'interactive-codex',
      args: [],
      status: 'completed',
      exitCode: 0,
      durationMs: 0,
      startedAt: checkpointAt,
      endedAt: checkpointAt,
      touchedFiles: changedFiles,
      failureCode: '',
      extra: {
        checkpointAt,
        launchMode: 'interactive-checkpoint',
      },
    }));
    await this.persistCheckpointContinuity({
      operation,
      command: 'interactive-codex',
      args: [],
      status: 'completed',
      correlationId,
      endedAtIso: checkpointAt,
      failureCode: '',
    });

    return {
      ok: true,
      correlationId,
      operation,
      touchedFiles: changedFiles,
      mode: 'interactive-checkpoint',
    };
  }

  async directLaunch(options = {}) {
    const command = String(options.command || 'codex');
    const args = Array.isArray(options.args) ? options.args : [];
    const touchedFiles = Array.isArray(options.touchedFiles) ? options.touchedFiles : [];
    const operation = String(options.operation || 'codex-direct-launch');
    const timeoutMs = toPositiveInt(options.timeoutMs, 0);
    const reason = normalize(options.reason);
    const overrideApprovedBy = normalize(options.overrideApprovedBy);
    const overrideApprovalTicket = normalize(options.overrideApprovalTicket);

    const session = await this.resolveRunnableSession();
    if (!session) {
      return {
        ok: false,
        code: 'session-not-runnable',
        message: 'unable to enter runnable session state for codex direct launch',
      };
    }

    await this.contextEngine.verifyQuiet();
    const policy = await this.policyEngine.load();
    const allowDirect = policy?.codex_runtime?.allow_direct_launch_exception === true;
    const actor = String(session.actorId || 'local');
    const sessionId = String(session.sessionId || '');
    const correlationId = randomUUID();
    const blockedAt = nowIso();

    if (!allowDirect) {
      await this.emitEvent('CodexDirectLaunchBlocked', sessionId, actor, this.buildExecutionPayload({
        correlationId,
        operation,
        command,
        args,
        status: 'blocked',
        exitCode: 1,
        durationMs: 0,
        startedAt: blockedAt,
        endedAt: blockedAt,
        touchedFiles,
        failureCode: 'direct-launch-disallowed',
      }));
      return {
        ok: false,
        code: 'direct-launch-disallowed',
        message: 'direct codex launch requires explicit exception policy',
      };
    }

    const governance = this.validateOverrideGovernance({
      mode: 'direct-launch',
      policy,
      reason,
      approvedBy: overrideApprovedBy,
      approvalTicket: overrideApprovalTicket,
      reasonKey: 'direct launch reason',
      reasonLengthKey: 'direct_launch_reason_min_length',
      requireReasonKey: 'require_direct_launch_reason',
      requireApprovalKey: 'require_direct_launch_approval',
      requireTicketKey: 'require_direct_launch_approval_ticket',
    });
    if (!governance.ok) {
      await this.emitEvent('CodexDirectLaunchBlocked', sessionId, actor, this.buildExecutionPayload({
        correlationId,
        operation,
        command,
        args,
        status: 'blocked',
        exitCode: 1,
        durationMs: 0,
        startedAt: blockedAt,
        endedAt: blockedAt,
        touchedFiles,
        failureCode: governance.code,
        extra: {
          message: governance.message,
        },
      }));
      return governance;
    }

    await this.emitEvent('CodexDirectLaunchApproved', sessionId, actor, this.buildExecutionPayload({
      correlationId,
      operation,
      command,
      args,
      status: 'completed',
      exitCode: 0,
      durationMs: 0,
      startedAt: blockedAt,
      endedAt: blockedAt,
      touchedFiles: [],
      failureCode: '',
      extra: {
        reason: governance.reason,
        approvedBy: governance.approvedBy,
        approvalTicket: governance.approvalTicket,
      },
    }));

    const startedAt = Date.now();
    const startedAtIso = nowIso();
    const changedFilesBefore = await this.listChangedFiles();
    const result = await this.runCommand(command, args, timeoutMs);
    const endedAt = Date.now();
    const endedAtIso = nowIso();
    const durationMs = endedAt - startedAt;
    const status = normalizeStatus(result.exitCode, false, result.timedOut === true);
    const changedFilesAfter = await this.listChangedFiles();
    const resolvedTouchedFiles = this.mergeTouchedFiles(touchedFiles, changedFilesBefore, changedFilesAfter);

    await this.emitEvent('CodexExecutionCaptured', sessionId, actor, this.buildExecutionPayload({
      correlationId,
      operation,
      command,
      args,
      status,
      exitCode: result.exitCode,
      durationMs,
      startedAt: startedAtIso,
      endedAt: endedAtIso,
      touchedFiles: resolvedTouchedFiles,
      failureCode: result.failureCode || '',
      extra: {
        errorMessage: result.errorMessage || '',
        launchMode: 'direct-exception',
        reason: governance.reason,
        approvedBy: governance.approvedBy,
        approvalTicket: governance.approvalTicket,
      },
    }));

    await this.emitEvent('CodexGovernedCheckpointCreated', sessionId, actor, this.buildExecutionPayload({
      correlationId,
      operation,
      command,
      args,
      status: 'completed',
      exitCode: 0,
      durationMs: 0,
      startedAt: endedAtIso,
      endedAt: endedAtIso,
      touchedFiles: [],
      failureCode: '',
      extra: {
        checkpointAt: endedAtIso,
      },
    }));
    await this.persistCheckpointContinuity({
      operation,
      command,
      args,
      status,
      correlationId,
      endedAtIso,
      failureCode: result.failureCode || '',
    });

    return {
      ok: result.exitCode === 0,
      exitCode: result.exitCode,
      correlationId,
      reason: governance.reason,
      approvedBy: governance.approvedBy,
      approvalTicket: governance.approvalTicket,
      mode: 'direct-exception',
    };
  }
}
