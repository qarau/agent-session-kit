import type { IsoTimestamp } from './shared.js';

export type AskProjectionRunMode = 'none' | 'full-replay' | 'incremental';
export type AskProjectionCursorIntegrity = 'unknown' | 'valid' | 'ahead' | 'behind';

export interface AskProjectionCursorState {
  lastAppliedSeq: number;
  requiresReplay: boolean;
  reason: string;
  updatedAt: IsoTimestamp;
}

export interface AskProjectionSequenceIntegrity {
  contiguous: boolean;
  monotonic: boolean;
  hasDuplicates: boolean;
  hasGaps: boolean;
  cursorIntegrity: AskProjectionCursorIntegrity;
}

export interface AskProjectionReplayProof {
  schemaVersion: number;
  mode: AskProjectionRunMode;
  eventCount: number;
  firstSeq: number;
  lastSeq: number;
  projectionCursor: number;
  replayHash: string;
  snapshotHash: string;
  sequenceIntegrity: AskProjectionSequenceIntegrity;
  generatedAt: IsoTimestamp;
}

export interface AskProjectionRunSummary {
  mode: Exclude<AskProjectionRunMode, 'none'>;
  eventsProcessed: number;
  lastSeq: number;
  replayHash?: string;
  snapshotHash?: string;
  sequenceIntegrity?: AskProjectionSequenceIntegrity;
}

export const askProjectionCursorStateFixture = {
  lastAppliedSeq: 4,
  requiresReplay: false,
  reason: 'incremental',
  updatedAt: '2026-05-10T00:00:00.000Z',
} satisfies AskProjectionCursorState;

export const askProjectionSequenceIntegrityFixture = {
  contiguous: true,
  monotonic: true,
  hasDuplicates: false,
  hasGaps: false,
  cursorIntegrity: 'valid',
} satisfies AskProjectionSequenceIntegrity;

export const askProjectionReplayProofFixture = {
  schemaVersion: 1,
  mode: 'incremental',
  eventCount: 4,
  firstSeq: 1,
  lastSeq: 4,
  projectionCursor: 4,
  replayHash: 'sha256:projection-replay',
  snapshotHash: 'sha256:projection-snapshot',
  sequenceIntegrity: askProjectionSequenceIntegrityFixture,
  generatedAt: '2026-05-10T00:00:01.000Z',
} satisfies AskProjectionReplayProof;

export const askProjectionRunSummaryFixture = {
  mode: 'incremental',
  eventsProcessed: 1,
  lastSeq: 4,
  replayHash: 'sha256:projection-replay',
  snapshotHash: 'sha256:projection-snapshot',
  sequenceIntegrity: askProjectionSequenceIntegrityFixture,
} satisfies AskProjectionRunSummary;
