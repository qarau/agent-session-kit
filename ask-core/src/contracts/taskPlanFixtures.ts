import type {
  AskMaterializedPlanSlice,
  AskPlanBatchRecord,
  AskPlanIngestOrigin,
  AskPlanV2,
  AskTaskRecord,
} from './tasks.js';

export const askPlanV2Fixture = {
  schemaVersion: 2,
  planPrefix: 'ask-ts',
  planTitle: 'ASK Forge v6 TypeScript Contract Foundation',
  planSummary: 'Generated from docs/plans/2026-05-09-ask-forge-v6-typescript-contract-foundation.md',
  slices: [
    {
      sliceId: 'typescript-tooling-foundation',
      title: 'TypeScript Tooling Foundation',
      description: 'Add TypeScript support without changing runtime behavior.',
      acceptanceCriteria: ['TypeScript tooling is installed with npm, not pnpm.'],
      queueClass: 'integrator',
    },
  ],
} satisfies AskPlanV2;

export const askPlanIngestOriginFixture = {
  type: 'plan-ingest',
  taskId: 'ask-forge-v6-typescript-contract-foundation',
  runId: 'ask-forge-v6-ts-foundation-run',
  artifactHash: 'sha256:example',
  planBatchId: 'ask-ts-example-001',
  sliceIndex: 1,
  sliceId: 'typescript-tooling-foundation',
} satisfies AskPlanIngestOrigin;

export const askTaskRecordFixture = {
  taskId: 'ask-ts-001',
  status: 'created',
  title: 'TypeScript Tooling Foundation',
  description: 'Add TypeScript support without changing runtime behavior.',
  origin: askPlanIngestOriginFixture,
  acceptanceCriteria: ['TypeScript tooling is installed with npm, not pnpm.'],
  queueClassHint: 'integrator',
  dependencies: [],
  createdAt: '2026-05-09T00:00:00.000Z',
  updatedAt: '2026-05-09T00:00:00.000Z',
  lastEventSeq: 1,
  lastEventType: 'TaskCreated',
} satisfies AskTaskRecord;

export const askMaterializedPlanSliceFixture = {
  taskId: 'ask-ts-001',
  sliceId: 'typescript-tooling-foundation',
  title: 'TypeScript Tooling Foundation',
  description: 'Add TypeScript support without changing runtime behavior.',
  dependencies: [],
  acceptanceCriteria: ['TypeScript tooling is installed with npm, not pnpm.'],
  queueClass: 'integrator',
  origin: askPlanIngestOriginFixture,
} satisfies AskMaterializedPlanSlice;

export const askPlanBatchRecordFixture = {
  planBatchId: 'ask-ts-example-001',
  artifactHash: 'sha256:example',
  taskId: 'ask-forge-v6-typescript-contract-foundation',
  runId: 'ask-forge-v6-ts-foundation-run',
  planPrefix: 'ask-ts',
  planTitle: 'ASK Forge v6 TypeScript Contract Foundation',
  createdAt: '2026-05-09T00:00:00.000Z',
  slices: [askMaterializedPlanSliceFixture],
} satisfies AskPlanBatchRecord;
