import type {
  CurrentActiveSession,
  CurrentPlanBatchRegistry,
  CurrentProjectionState,
  CurrentRuntimeEventRecord,
  CurrentSequenceState,
  CurrentTaskBoardSnapshot,
} from './currentArtifacts.js';

export const currentRuntimeEventFixture = {
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
} satisfies CurrentRuntimeEventRecord;

export const currentSequenceStateFixture = {
  nextSeq: 2,
} satisfies CurrentSequenceState;

export const currentProjectionStateFixture = {
  lastSeq: 1,
  updatedAt: '2026-05-09T00:00:00.000Z',
  cursorIntegrity: 'valid',
} satisfies CurrentProjectionState;

export const currentActiveSessionFixture = {
  sessionId: 'sess_example',
  actorId: 'local',
  status: 'active',
  branch: 'release-v4.0.0-sync-local',
  worktree: 'C:/repo/agent-session-kit-sync',
} satisfies CurrentActiveSession;

export const currentTaskBoardFixture = {
  tasks: {
    'ask-ts-001': {
      taskId: 'ask-ts-001',
      status: 'created',
      title: 'TypeScript Tooling Foundation',
      description: 'Add TypeScript support without changing runtime behavior.',
      origin: {
        type: 'plan-ingest',
        taskId: 'ask-forge-v6-typescript-contract-foundation',
        runId: 'ask-forge-v6-ts-foundation-run',
        artifactHash: 'sha256:example',
        planBatchId: 'ask-ts-example-001',
        sliceIndex: 1,
        sliceId: 'typescript-tooling-foundation',
      },
      acceptanceCriteria: ['TypeScript tooling is installed with npm, not pnpm.'],
      queueClassHint: 'integrator',
      dependencies: [],
    },
  },
} satisfies CurrentTaskBoardSnapshot;

export const currentPlanBatchRegistryFixture = {
  schemaVersion: 1,
  artifactHashes: {
    'sha256:example': 'ask-ts-example-001',
  },
  batches: {
    'ask-ts-example-001': {
      planBatchId: 'ask-ts-example-001',
      artifactHash: 'sha256:example',
      taskId: 'ask-forge-v6-typescript-contract-foundation',
      runId: 'ask-forge-v6-ts-foundation-run',
      planPrefix: 'ask-ts',
      planTitle: 'ASK Forge v6 TypeScript Contract Foundation',
      createdAt: '2026-05-09T00:00:00.000Z',
      slices: [
        {
          taskId: 'ask-ts-001',
          sliceId: 'typescript-tooling-foundation',
          title: 'TypeScript Tooling Foundation',
          dependencies: [],
          queueClass: 'integrator',
        },
      ],
    },
  },
} satisfies CurrentPlanBatchRegistry;
