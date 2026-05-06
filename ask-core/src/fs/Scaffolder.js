import path from 'node:path';
import { AskPaths } from './AskPaths.js';
import { FileStore } from './FileStore.js';
import { defaultPolicyYaml } from '../policy/defaultPolicy.js';

function nowIso() {
  return new Date().toISOString();
}

function timestampForFileName() {
  return nowIso().replace(/[:.]/gu, '-');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseRuntimeEvents(raw) {
  const lines = String(raw ?? '')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean);

  const records = [];
  const parseErrors = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      parseErrors.push({
        line: index + 1,
        reason: String(error?.message ?? 'invalid-json'),
      });
    }
  }
  return {
    lines,
    records,
    parseErrors,
  };
}

function inspectSequence(records) {
  const issues = [];
  const seen = new Set();
  let previous = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < records.length; index += 1) {
    const expected = index + 1;
    const record = records[index];
    const seq = toNumber(record?.seq, NaN);

    if (!Number.isFinite(seq)) {
      issues.push({
        kind: 'invalid-seq',
        index,
        expected,
        actual: record?.seq,
      });
      continue;
    }
    if (seen.has(seq)) {
      issues.push({
        kind: 'duplicate-seq',
        index,
        expected,
        actual: seq,
      });
    }
    if (seq <= previous) {
      issues.push({
        kind: 'non-monotonic-seq',
        index,
        expected,
        actual: seq,
      });
    }
    if (seq !== expected) {
      issues.push({
        kind: 'gap-or-misaligned-seq',
        index,
        expected,
        actual: seq,
      });
    }
    previous = seq;
    seen.add(seq);
  }

  return {
    hasIssues: issues.length > 0,
    issues,
  };
}

function defaultActiveSession() {
  return {
    sessionId: '',
    status: 'idle',
    branch: '',
    worktree: '',
    taskId: '',
    actorType: '',
    actorId: '',
    startedAt: '',
    lastActiveAt: '',
  };
}

function defaultLatestChecks() {
  return {
    docsFresh: false,
    testsPassed: false,
    checks: [],
  };
}

function defaultWorkContext() {
  return {
    repoRoot: '',
    branch: '',
    worktree: '',
    verifiedAt: '',
  };
}

function defaultSessionSnapshot() {
  return {
    sessionId: '',
    status: 'idle',
    goal: '',
    branch: '',
    worktree: '',
    startedAt: '',
    lastActiveAt: '',
    lastHandoffAt: '',
  };
}

function defaultProjectionState() {
  return {
    lastAppliedSeq: 0,
    requiresReplay: false,
    updatedAt: '',
    reason: '',
  };
}

function defaultResumePacket() {
  return {
    version: '1.0',
    sessionId: '',
    goal: '',
    status: 'idle',
    phase: '',
    currentIntent: '',
    currentTask: '',
    lastCompleted: '',
    latestExecution: {},
    latestValidation: {},
    nextAction: '',
    riskNotes: [],
    contextRecoveryCost: {
      estimatedTokens: 0,
      targetPercent: 10,
    },
    updatedAt: '',
  };
}

function defaultRuntimeMetrics() {
  return {
    sessionDurationMs: 0,
    sliceDurationMs: 0,
    executionDurationMs: 0,
    checkpointDurationMs: 0,
    validationPassRate: 0,
    failureRecoveryRate: 0,
    contextRecoveryCost: 0,
    filesTouchedPerSlice: 0,
    commandsRunPerSlice: 0,
    retryCount: 0,
    blockedCount: 0,
    policyOverrideCount: 0,
    loopsRun: 0,
    updatedAt: '',
  };
}

function snapshotDefaults(paths) {
  return [
    [paths.taskBoardSnapshot(), { tasks: {} }],
    [paths.verificationSnapshot(), { tasks: {} }],
    [paths.workflowSnapshot(), { tasks: {} }],
    [paths.freshnessSnapshot(), { tasks: {} }],
    [paths.integrationSnapshot(), { tasks: {} }],
    [paths.mergeReadinessSnapshot(), { tasks: {} }],
    [paths.claimsSnapshot(), { tasks: {} }],
    [paths.routingSnapshot(), { tasks: {} }],
    [paths.childSessionsSnapshot(), { tasks: {} }],
    [paths.agentsSnapshot(), { agents: {} }],
    [paths.queueClassesSnapshot(), { tasks: {} }],
    [paths.policyPacksSnapshot(), { tasks: {} }],
    [paths.featuresSnapshot(), { features: {} }],
    [paths.releaseTrainsSnapshot(), { trains: {} }],
    [paths.promotionGatesSnapshot(), { features: {} }],
    [paths.rolloutSnapshot(), { features: {} }],
    [paths.subagentDispatchSnapshot(), { tasks: {} }],
    [paths.subagentDispatchControlSnapshot(), { tasks: {} }],
  ];
}

export class Scaffolder {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async ensureJson(filePath, payload) {
    if (!await this.store.exists(filePath)) {
      await this.store.writeJson(filePath, payload);
    }
  }

  async initializeStructure() {
    await this.store.ensureDir(this.paths.policyDir());
    await this.store.ensureDir(this.paths.sessionsDir());
    await this.store.ensureDir(this.paths.continuityDir());
    await this.store.ensureDir(this.paths.evidenceDir());
    await this.store.ensureDir(this.paths.handoffsDir());
    await this.store.ensureDir(this.paths.stateDir());
    await this.store.ensureDir(this.paths.runtimeDir());
    await this.store.ensureDir(this.paths.runtimeSnapshotsDir());
    await this.store.ensureDir(this.paths.tasksDir());
    await this.store.ensureDir(this.paths.worktreesDir());
  }

  async initializeDefaults(overwrite = false) {
    await this.store.ensureText(this.paths.runtimePolicy(), defaultPolicyYaml);

    if (overwrite) {
      await this.store.writeText(this.paths.historyLog(), '');
      await this.store.writeText(this.paths.runtimeEvents(), '');
      await this.store.writeJson(this.paths.sequenceState(), { nextSeq: 1 });
      await this.store.writeJson(this.paths.activeSession(), defaultActiveSession());
      await this.store.deleteFile(this.paths.pendingTransition());
      await this.store.writeJson(this.paths.latestChecks(), defaultLatestChecks());
      await this.store.writeJson(this.paths.workContext(), defaultWorkContext());
      await this.store.writeJson(this.paths.sessionSnapshot(), defaultSessionSnapshot());
      await this.store.writeJson(this.paths.projectionState(), defaultProjectionState());
      await this.store.writeJson(this.paths.resumePacket(), defaultResumePacket());
      await this.store.writeJson(this.paths.runtimeMetrics(), defaultRuntimeMetrics());
      for (const [snapshotPath, fallback] of snapshotDefaults(this.paths)) {
        await this.store.writeJson(snapshotPath, fallback);
      }
      await this.store.writeJson(this.paths.taskRegistry(), { tasks: {} });
    } else {
      await this.store.ensureText(this.paths.historyLog(), '');
      await this.store.ensureText(this.paths.runtimeEvents(), '');
      await this.ensureJson(this.paths.sequenceState(), { nextSeq: 1 });
      await this.ensureJson(this.paths.activeSession(), defaultActiveSession());
      await this.ensureJson(this.paths.latestChecks(), defaultLatestChecks());
      await this.ensureJson(this.paths.workContext(), defaultWorkContext());
      await this.ensureJson(this.paths.sessionSnapshot(), defaultSessionSnapshot());
      await this.ensureJson(this.paths.resumePacket(), defaultResumePacket());
      await this.ensureJson(this.paths.runtimeMetrics(), defaultRuntimeMetrics());
      for (const [snapshotPath, fallback] of snapshotDefaults(this.paths)) {
        await this.ensureJson(snapshotPath, fallback);
      }
      await this.ensureJson(this.paths.taskRegistry(), { tasks: {} });
    }

    await this.store.ensureText(this.paths.currentStatus(), '# Current Status\n');
    await this.store.ensureText(this.paths.openLoops(), '# Open Loops\n');
    await this.store.ensureText(this.paths.nextActions(), '# Next Actions\n');
    await this.store.ensureText(this.paths.latestHandoff(), '# Latest Handoff\n');
  }

  async repairRuntimeSequenceIfNeeded() {
    const rawEvents = await this.store.readText(this.paths.runtimeEvents(), '');
    const sequenceState = await this.store.readJson(this.paths.sequenceState(), { nextSeq: 1 });
    const projectionStateExists = await this.store.exists(this.paths.projectionState());
    const projectionState = await this.store.readJson(this.paths.projectionState(), defaultProjectionState());
    const parsed = parseRuntimeEvents(rawEvents);
    const inspected = inspectSequence(parsed.records);
    const needsResequence = parsed.parseErrors.length > 0 || inspected.hasIssues;

    const reportBase = {
      checkedAt: nowIso(),
      repaired: false,
      mode: 'none',
      eventLineCount: parsed.lines.length,
      parsedEventCount: parsed.records.length,
      parseErrors: parsed.parseErrors,
      sequenceIssues: inspected.issues,
      previousNextSeq: toNumber(sequenceState.nextSeq, 1),
      nextSeq: toNumber(sequenceState.nextSeq, 1),
      backupPath: '',
    };

    if (needsResequence) {
      const backupPath = path.join(this.paths.runtimeDir(), `events.backup.${timestampForFileName()}.ndjson`);
      await this.store.writeText(backupPath, rawEvents);

      const resequenced = parsed.records.map((event, index) => ({
        ...event,
        seq: index + 1,
      }));
      const body = resequenced.map(event => JSON.stringify(event)).join('\n');
      await this.store.writeText(this.paths.runtimeEvents(), body ? `${body}\n` : '');
      await this.store.writeJson(this.paths.sequenceState(), { nextSeq: resequenced.length + 1 });

      await this.store.writeJson(this.paths.projectionState(), {
        ...projectionState,
        lastAppliedSeq: 0,
        requiresReplay: true,
        reason: 'sequence-repair',
        updatedAt: nowIso(),
      });

      await this.store.writeJson(this.paths.sequenceRepairReport(), {
        ...reportBase,
        repaired: true,
        mode: 'resequence',
        nextSeq: resequenced.length + 1,
        backupPath,
      });
      return;
    }

    const maxSeq = parsed.records.reduce((max, event) => {
      const seq = toNumber(event?.seq, 0);
      return seq > max ? seq : max;
    }, 0);
    const currentNext = toNumber(sequenceState.nextSeq, 1);
    if (currentNext <= maxSeq) {
      const bumped = maxSeq + 1;
      await this.store.writeJson(this.paths.sequenceState(), { nextSeq: bumped });
      await this.store.writeJson(this.paths.sequenceRepairReport(), {
        ...reportBase,
        repaired: true,
        mode: 'next-seq-bumped',
        nextSeq: bumped,
      });
      return;
    }

    if (!projectionStateExists) {
      await this.store.writeJson(this.paths.projectionState(), {
        ...projectionState,
        lastAppliedSeq: 0,
        requiresReplay: parsed.records.length > 0,
        reason: parsed.records.length > 0 ? 'projection-state-bootstrap' : '',
        updatedAt: nowIso(),
      });
    }

    await this.store.writeJson(this.paths.sequenceRepairReport(), reportBase);
  }

  async init(options = {}) {
    const resetRuntime = options.resetRuntime === true;
    await this.initializeStructure();
    await this.initializeDefaults(resetRuntime);
    if (!resetRuntime) {
      await this.repairRuntimeSequenceIfNeeded();
    }
  }
}
