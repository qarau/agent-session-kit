import type {
  ArchitectValidationCompletedEvent,
  EntropyImpactMeasuredEvent,
  OhderFindingDetectedEvent,
  PlanModeHandoffIngestedEvent,
  TaskCreatedEvent,
} from './events.js';

export const taskCreatedEventFixture = {
  seq: 1,
  type: 'TaskCreated',
  ts: '2026-05-09T00:00:00.000Z',
  sessionId: 'sess_example',
  taskId: 'ask-ts-001',
  actor: 'local',
  payload: {
    title: 'TypeScript Tooling Foundation',
    description: 'Add TypeScript support without changing runtime behavior.',
  },
  meta: {
    source: 'task-runtime',
  },
} satisfies TaskCreatedEvent;

export const planModeHandoffIngestedEventFixture = {
  seq: 2,
  type: 'PlanModeHandoffIngested',
  ts: '2026-05-09T00:00:01.000Z',
  sessionId: 'sess_example',
  taskId: 'ask-forge-v6-typescript-contract-foundation',
  actor: 'local',
  payload: {
    status: 'ingested',
    title: 'ASK Forge v6 TypeScript Contract Foundation',
    taskId: 'ask-forge-v6-typescript-contract-foundation',
    runId: 'ask-forge-v6-ts-foundation-run',
    workflow: 'superpowers',
    skill: 'writing-plans',
    sourceMarkdownPath: 'docs/plans/2026-05-09-ask-forge-v6-typescript-contract-foundation.md',
    planJsonPath: 'docs/plans/2026-05-09-ask-forge-v6-typescript-contract-foundation.plan.json',
    planBatchId: 'ask-ts-example-001',
    artifactHash: 'sha256:example',
    createdTaskIds: ['ask-ts-001'],
    nextTaskId: 'ask-ts-001',
  },
  meta: {
    source: 'plan-mode-handoff-runtime',
    schemaVersion: 1,
  },
} satisfies PlanModeHandoffIngestedEvent;

export const architectValidationCompletedEventFixture = {
  seq: 3,
  type: 'ArchitectValidationCompleted',
  ts: '2026-05-09T00:00:02.000Z',
  sessionId: 'sess_example',
  taskId: 'ask-ts-001',
  actor: 'local',
  payload: {
    taskId: 'ask-ts-001',
    sliceId: 'ask-ts-001',
    status: 'warning',
    blocking: false,
    lawOutcome: 'allow',
    lawViolations: [],
    entropyDelta: 1,
    couplingDelta: 0,
    replayabilityRisk: 'low',
  },
  meta: {
    source: 'slice-close-runtime',
    schemaVersion: 1,
  },
} satisfies ArchitectValidationCompletedEvent;

export const entropyImpactMeasuredEventFixture = {
  seq: 4,
  type: 'EntropyImpactMeasured',
  ts: '2026-05-09T00:00:03.000Z',
  sessionId: 'sess_example',
  taskId: 'ask-ts-001',
  actor: 'local',
  payload: {
    taskId: 'ask-ts-001',
    sliceId: 'ask-ts-001',
    entropy: {
      entropyScore: 0.1,
      trend: 'stable',
    },
    history: {
      source: 'slice-close',
      taskId: 'ask-ts-001',
    },
  },
  meta: {
    source: 'slice-close-runtime',
    schemaVersion: 1,
  },
} satisfies EntropyImpactMeasuredEvent;

export const ohderFindingDetectedEventFixture = {
  seq: 5,
  type: 'OhderFindingDetected',
  ts: '2026-05-09T00:00:04.000Z',
  sessionId: 'sess_example',
  actor: 'local',
  payload: {
    findingId: 'ohder-finding-example',
    metric: 'srp_integrity',
    severity: 'medium',
    evidence: [],
  },
  meta: {
    source: 'finding-resolution-runtime',
    schemaVersion: 1,
  },
} satisfies OhderFindingDetectedEvent;
