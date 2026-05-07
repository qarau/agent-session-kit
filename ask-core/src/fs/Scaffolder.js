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
    latestArchitect: {},
    latestFlow: {},
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
    architectureDriftScore: 0,
    behaviorDriftScore: 0,
    driftTrend: 'stable',
    driftWindowSize: 0,
    updatedAt: '',
  };
}

function defaultDriftAnalytics() {
  return {
    windowSize: 0,
    architecture: {
      entropyTrend: 'stable',
      couplingTrend: 'stable',
      replayabilityTrend: 'stable',
      driftScore: 0,
    },
    behavior: {
      replayConfidenceTrend: 'stable',
      protectedViolationTrend: 'stable',
      hardViolationTrend: 'stable',
      driftScore: 0,
    },
    overall: {
      trend: 'stable',
      driftScore: 0,
    },
    updatedAt: '',
  };
}

function defaultArchitectStatus() {
  return {
    status: 'unknown',
    blocking: false,
    entropyDelta: 0,
    couplingDelta: 0,
    replayabilityRisk: 'unknown',
    findings: [],
    lawPackVersion: 1,
    lawOutcome: '',
    lawViolations: [],
    lawExemptions: [],
    recommendedAction: '',
    updatedAt: '',
  };
}

function defaultFlowContract() {
  return {
    flows: [
      {
        id: 'task-completion-order',
        name: 'Completed tasks move to bottom',
        stage: 'hard-flow',
        criticality: 'hard-flow',
        given: 'A list contains incomplete and completed tasks',
        when: 'The user completes a task',
        then: [
          'Task moves below incomplete tasks',
          'Highlight clears',
          'Progress updates',
        ],
        mustNever: [
          'Completed tasks remain above incomplete tasks',
        ],
      },
    ],
  };
}

function defaultFlowMap() {
  return {
    'task-completion-order': {
      files: [
        'src/**',
        'src/**/*task*',
        'src/**/*todo*',
      ],
      tests: [
        'task-completion-order',
      ],
    },
  };
}

function defaultFlowMetrics() {
  return {
    validationRuns: 0,
    flowRegressionRate: 0,
    protectedFlowViolations: 0,
    hardFlowViolations: 0,
    behaviorDriftTrend: 'stable',
    updatedAt: '',
  };
}

function defaultFlowStatus() {
  return {
    status: 'unknown',
    blocking: false,
    impactedFlows: [],
    protectedFlowViolations: [],
    hardFlowViolations: [],
    behaviorReplay: {
      status: 'unknown',
      confidence: 0,
      impactedFlowCount: 0,
      flowReplays: [],
      regressionEvidence: [],
    },
    updatedAt: '',
  };
}

function defaultDesignStatus() {
  return {
    status: 'unknown',
    blocking: false,
    reason: '',
    sliceId: '',
    impactedRegions: [],
    warnings: [],
    metrics: {
      visualDriftTrend: 'stable',
      protectedDesignViolations: 0,
      componentFragmentationRate: 0,
      modalConsistencyScore: 1,
      spacingRhythmScore: 1,
      uxAestheticScore: 1,
      brandConsistencyScore: 1,
      validationRuns: 0,
      updatedAt: '',
    },
    updatedAt: '',
  };
}

function defaultLoopState() {
  return {
    loopId: '',
    sessionId: '',
    status: 'idle',
    currentStep: {
      index: 0,
      name: '',
      enteredAt: '',
    },
    history: [],
    decision: '',
    startedAt: '',
    completedAt: '',
    updatedAt: '',
  };
}

function defaultDesignSystemDoc() {
  return `# Design System Memory

## Foundations

- Maintain consistent spacing rhythm and component coherence.
- Preserve typography hierarchy and brand visual language.

## Modal System

All modals should align on shell structure, radius, spacing, and button hierarchy.
`;
}

function defaultDesignTokens() {
  return {
    colors: {
      primary: '#5B8DEF',
      surface: '#FFFFFF',
      success: '#22C55E',
    },
    radius: {
      card: '24px',
      modal: '24px',
    },
    spacing: {
      sectionGap: '32px',
      modalPadding: '24px',
    },
    typography: {
      headingWeight: 700,
      bodyWeight: 400,
    },
  };
}

function defaultComponentPatterns() {
  return {
    'modal-shell': {
      radius: '24px',
      padding: '24px',
      overlayOpacity: 0.45,
      buttonHierarchy: 'secondary-left-primary-right',
      status: 'guided',
    },
  };
}

function defaultModalContracts() {
  return {
    'reward-modal': {
      mustMatch: ['celebration-modal'],
      sharedRules: ['same-shell', 'same-radius', 'same-button-hierarchy'],
      status: 'guided',
    },
  };
}

function defaultVisualRegressionMap() {
  return {
    'modal-system': {
      files: ['src/**/*modal*', 'src/**/*Modal*'],
      protectedRules: ['same-shell', 'same-radius'],
      status: 'guided',
    },
  };
}

function defaultDesignMetrics() {
  return {
    visualDriftTrend: 'stable',
    protectedDesignViolations: 0,
    componentFragmentationRate: 0,
    modalConsistencyScore: 1,
    spacingRhythmScore: 1,
    uxAestheticScore: 1,
    brandConsistencyScore: 1,
    validationRuns: 0,
    updatedAt: '',
  };
}

function defaultGovernanceDecision() {
  return {
    loopId: '',
    sessionId: '',
    sliceId: '',
    intentType: '',
    decision: '',
    reason: '',
    recoveryStatus: '',
    validationStatus: '',
    architectStatus: '',
    flowStatus: '',
    blocking: false,
    writtenAt: '',
  };
}

function defaultReplayProof() {
  return {
    schemaVersion: 1,
    mode: 'none',
    eventCount: 0,
    firstSeq: 0,
    lastSeq: 0,
    projectionCursor: 0,
    replayHash: '',
    snapshotHash: '',
    sequenceIntegrity: {
      contiguous: true,
      monotonic: true,
      hasDuplicates: false,
      hasGaps: false,
      cursorIntegrity: 'unknown',
    },
    generatedAt: '',
  };
}

function defaultOhderLawPack() {
  return {
    version: 1,
    defaultOutcomes: {
      critical: 'block',
      high: 'retry',
      medium: 'warn',
      low: 'warn',
    },
    laws: [
      {
        id: 'ohder-replayability-integrity',
        name: 'Replayability Integrity',
        lawClass: 'hard',
        enabled: true,
        severity: 'critical',
        metric: 'replayability_risk',
        operator: '!=',
        value: 'high',
        outcome: 'block',
        message: 'Replayability risk must not be high.',
      },
      {
        id: 'ohder-entropy-budget',
        name: 'Entropy Budget',
        lawClass: 'soft',
        enabled: true,
        severity: 'high',
        metric: 'entropy_delta',
        operator: '<=',
        value: 3,
        outcome: 'retry',
        message: 'Entropy increase exceeded allowed budget.',
      },
      {
        id: 'ohder-coupling-budget',
        name: 'Coupling Budget',
        lawClass: 'soft',
        enabled: true,
        severity: 'high',
        metric: 'coupling_delta',
        operator: '<=',
        value: 2,
        outcome: 'retry',
        message: 'Coupling increase exceeded allowed budget.',
      },
      {
        id: 'ohder-validation-integrity',
        name: 'Validation Integrity',
        lawClass: 'hard',
        enabled: true,
        severity: 'critical',
        metric: 'validation_status',
        operator: 'in',
        value: ['passed', 'warning'],
        outcome: 'block',
        message: 'Validation must pass or warn before continuation.',
      },
    ],
    exemptions: [],
  };
}

function defaultProductFlowDoc() {
  return `# Product Flow Memory

## Task Completion

When a user completes a task:
- task moves below incomplete tasks
- highlight clears
- progress updates

Criticality: HARD FLOW
`;
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
    await this.store.ensureDir(this.paths.flowsDir());
    await this.store.ensureDir(this.paths.designDir());
    await this.store.ensureDir(this.paths.worktreesDir());
  }

  async initializeDefaults(overwrite = false) {
    await this.store.ensureText(this.paths.runtimePolicy(), defaultPolicyYaml);
    await this.ensureJson(this.paths.ohderLawPack(), defaultOhderLawPack());

    if (overwrite) {
      await this.store.writeJson(this.paths.ohderLawPack(), defaultOhderLawPack());
      await this.store.writeText(this.paths.historyLog(), '');
      await this.store.writeText(this.paths.runtimeEvents(), '');
      await this.store.writeText(this.paths.runtimeMetricsHistory(), '');
      await this.store.writeJson(this.paths.sequenceState(), { nextSeq: 1 });
      await this.store.writeJson(this.paths.activeSession(), defaultActiveSession());
      await this.store.deleteFile(this.paths.pendingTransition());
      await this.store.writeJson(this.paths.latestChecks(), defaultLatestChecks());
      await this.store.writeJson(this.paths.workContext(), defaultWorkContext());
      await this.store.writeJson(this.paths.sessionSnapshot(), defaultSessionSnapshot());
      await this.store.writeJson(this.paths.projectionState(), defaultProjectionState());
      await this.store.writeJson(this.paths.resumePacket(), defaultResumePacket());
      await this.store.writeJson(this.paths.runtimeMetrics(), defaultRuntimeMetrics());
      await this.store.writeJson(this.paths.runtimeDriftAnalytics(), defaultDriftAnalytics());
      await this.store.writeJson(this.paths.architectStatus(), defaultArchitectStatus());
      await this.store.writeJson(this.paths.flowStatus(), defaultFlowStatus());
      await this.store.writeJson(this.paths.designStatus(), defaultDesignStatus());
      await this.store.writeJson(this.paths.loopState(), defaultLoopState());
      await this.store.writeJson(this.paths.governanceDecision(), defaultGovernanceDecision());
      await this.store.writeJson(this.paths.replayProof(), defaultReplayProof());
      await this.store.writeJson(this.paths.productFlowContract(), defaultFlowContract());
      await this.store.writeJson(this.paths.flowMap(), defaultFlowMap());
      await this.store.writeJson(this.paths.flowMetrics(), defaultFlowMetrics());
      await this.store.writeJson(this.paths.designTokens(), defaultDesignTokens());
      await this.store.writeJson(this.paths.componentPatterns(), defaultComponentPatterns());
      await this.store.writeJson(this.paths.modalContracts(), defaultModalContracts());
      await this.store.writeJson(this.paths.visualRegressionMap(), defaultVisualRegressionMap());
      await this.store.writeJson(this.paths.designMetrics(), defaultDesignMetrics());
      await this.store.writeText(this.paths.productFlowDoc(), defaultProductFlowDoc());
      await this.store.writeText(this.paths.designSystemDoc(), defaultDesignSystemDoc());
      await this.store.writeText(this.paths.flowHistory(), '');
      await this.store.writeText(this.paths.designHistory(), '');
      for (const [snapshotPath, fallback] of snapshotDefaults(this.paths)) {
        await this.store.writeJson(snapshotPath, fallback);
      }
      await this.store.writeJson(this.paths.taskRegistry(), { tasks: {} });
      await this.store.writeJson(this.paths.planBatchRegistry(), {
        schemaVersion: 1,
        batches: {},
        artifactHashes: {},
      });
    } else {
      await this.store.ensureText(this.paths.historyLog(), '');
      await this.store.ensureText(this.paths.runtimeEvents(), '');
      await this.store.ensureText(this.paths.runtimeMetricsHistory(), '');
      await this.ensureJson(this.paths.sequenceState(), { nextSeq: 1 });
      await this.ensureJson(this.paths.activeSession(), defaultActiveSession());
      await this.ensureJson(this.paths.latestChecks(), defaultLatestChecks());
      await this.ensureJson(this.paths.workContext(), defaultWorkContext());
      await this.ensureJson(this.paths.sessionSnapshot(), defaultSessionSnapshot());
      await this.ensureJson(this.paths.resumePacket(), defaultResumePacket());
      await this.ensureJson(this.paths.runtimeMetrics(), defaultRuntimeMetrics());
      await this.ensureJson(this.paths.runtimeDriftAnalytics(), defaultDriftAnalytics());
      await this.ensureJson(this.paths.architectStatus(), defaultArchitectStatus());
      await this.ensureJson(this.paths.flowStatus(), defaultFlowStatus());
      await this.ensureJson(this.paths.designStatus(), defaultDesignStatus());
      await this.ensureJson(this.paths.loopState(), defaultLoopState());
      await this.ensureJson(this.paths.governanceDecision(), defaultGovernanceDecision());
      await this.ensureJson(this.paths.replayProof(), defaultReplayProof());
      await this.ensureJson(this.paths.productFlowContract(), defaultFlowContract());
      await this.ensureJson(this.paths.flowMap(), defaultFlowMap());
      await this.ensureJson(this.paths.flowMetrics(), defaultFlowMetrics());
      await this.ensureJson(this.paths.designTokens(), defaultDesignTokens());
      await this.ensureJson(this.paths.componentPatterns(), defaultComponentPatterns());
      await this.ensureJson(this.paths.modalContracts(), defaultModalContracts());
      await this.ensureJson(this.paths.visualRegressionMap(), defaultVisualRegressionMap());
      await this.ensureJson(this.paths.designMetrics(), defaultDesignMetrics());
      await this.store.ensureText(this.paths.productFlowDoc(), defaultProductFlowDoc());
      await this.store.ensureText(this.paths.designSystemDoc(), defaultDesignSystemDoc());
      await this.store.ensureText(this.paths.flowHistory(), '');
      await this.store.ensureText(this.paths.designHistory(), '');
      for (const [snapshotPath, fallback] of snapshotDefaults(this.paths)) {
        await this.ensureJson(snapshotPath, fallback);
      }
      await this.ensureJson(this.paths.taskRegistry(), { tasks: {} });
      await this.ensureJson(this.paths.planBatchRegistry(), {
        schemaVersion: 1,
        batches: {},
        artifactHashes: {},
      });
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
