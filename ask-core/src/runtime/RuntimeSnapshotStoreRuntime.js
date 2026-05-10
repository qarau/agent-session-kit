function isRecord(payload) {
  return Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload);
}

export function createDefaultProjectionState() {
  return {
    lastAppliedSeq: 0,
    requiresReplay: false,
    reason: '',
    updatedAt: '',
  };
}

export function createDefaultReplayProof() {
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

export function normalizeProjectionState(payload = {}, clock = () => new Date().toISOString()) {
  const source = isRecord(payload) ? payload : {};
  const lastAppliedSeq = Number(source.lastAppliedSeq ?? 0);
  return {
    ...createDefaultProjectionState(),
    ...source,
    lastAppliedSeq: Number.isFinite(lastAppliedSeq) && lastAppliedSeq >= 0 ? lastAppliedSeq : 0,
    requiresReplay: source.requiresReplay === true,
    reason: typeof source.reason === 'string' ? source.reason : '',
    updatedAt: source.updatedAt || clock(),
  };
}

export function mergeReplayProof(
  previous = createDefaultReplayProof(),
  payload = {},
  clock = () => new Date().toISOString(),
) {
  return {
    ...previous,
    ...payload,
    generatedAt: payload.generatedAt || clock(),
  };
}
