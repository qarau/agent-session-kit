import type {
  AskProjectionCursorState,
  AskProjectionReplayProof,
} from '../contracts/projection.js';

export type AskRuntimeSnapshotClock = () => string;

export type AskProjectionCursorStateWithLegacyFields = AskProjectionCursorState & Record<string, unknown>;

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload);
}

export function createDefaultProjectionState(): AskProjectionCursorState {
  return {
    lastAppliedSeq: 0,
    requiresReplay: false,
    reason: '',
    updatedAt: '',
  };
}

export function createDefaultReplayProof(): AskProjectionReplayProof {
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

export function normalizeProjectionState(
  payload: unknown = {},
  clock: AskRuntimeSnapshotClock = () => new Date().toISOString(),
): AskProjectionCursorStateWithLegacyFields {
  const source = isRecord(payload) ? payload : {};
  const lastAppliedSeq = Number(source.lastAppliedSeq ?? 0);
  return {
    ...createDefaultProjectionState(),
    ...source,
    lastAppliedSeq: Number.isFinite(lastAppliedSeq) && lastAppliedSeq >= 0 ? lastAppliedSeq : 0,
    requiresReplay: source.requiresReplay === true,
    reason: typeof source.reason === 'string' ? source.reason : '',
    updatedAt: source.updatedAt || clock(),
  } as AskProjectionCursorStateWithLegacyFields;
}

export function mergeReplayProof(
  previous: AskProjectionReplayProof = createDefaultReplayProof(),
  payload: Partial<AskProjectionReplayProof> = {},
  clock: AskRuntimeSnapshotClock = () => new Date().toISOString(),
): AskProjectionReplayProof {
  return {
    ...previous,
    ...payload,
    generatedAt: payload.generatedAt || clock(),
  };
}

export const askRuntimeSnapshotProjectionStateFixture = normalizeProjectionState(
  {
    lastAppliedSeq: '4',
    requiresReplay: false,
    reason: 'incremental',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
  () => '2026-05-10T00:00:00.000Z',
);

export const askRuntimeSnapshotReplayProofFixture = mergeReplayProof(
  createDefaultReplayProof(),
  {
    mode: 'incremental',
    eventCount: 4,
    firstSeq: 1,
    lastSeq: 4,
    projectionCursor: 4,
    replayHash: 'sha256:runtime-snapshot-replay',
    snapshotHash: 'sha256:runtime-snapshot-state',
    sequenceIntegrity: {
      contiguous: true,
      monotonic: true,
      hasDuplicates: false,
      hasGaps: false,
      cursorIntegrity: 'valid',
    },
    generatedAt: '2026-05-10T00:00:01.000Z',
  },
  () => '2026-05-10T00:00:01.000Z',
);
