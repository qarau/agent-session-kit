function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function shortHash(value) {
  return normalizePlanBatchValue(value).replace(/^sha256:/u, '').slice(0, 6);
}

export function normalizePlanBatchValue(value) {
  return String(value ?? '').trim();
}

export function normalizePlanBatchRegistry(payload) {
  if (!isPlainObject(payload) || !isPlainObject(payload.batches) || !isPlainObject(payload.artifactHashes)) {
    return {
      ok: false,
      code: 'E_PLAN_BATCH_INVALID',
      message: 'plan batch registry is invalid',
    };
  }

  const artifactHashes = Object.fromEntries(
    Object.entries(payload.artifactHashes).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.map(entry => normalizePlanBatchValue(entry)).filter(Boolean) : [],
    ])
  );

  return {
    ok: true,
    registry: {
      schemaVersion: toNumber(payload.schemaVersion, 1),
      batches: { ...payload.batches },
      artifactHashes,
    },
  };
}

export function buildPlanBatchBase(prepared) {
  const materialized = Array.isArray(prepared.materialized) ? prepared.materialized : [];
  return {
    planBatchId: normalizePlanBatchValue(prepared.planBatchId),
    artifactHash: normalizePlanBatchValue(prepared.artifactHash),
    taskId: normalizePlanBatchValue(prepared.taskId),
    runId: normalizePlanBatchValue(prepared.runId),
    artifactPath: normalizePlanBatchValue(prepared.artifact?.path),
    planPrefix: normalizePlanBatchValue(prepared.planPrefix),
    planTitle: normalizePlanBatchValue(prepared.planTitle),
    sliceCount: materialized.length,
    plannedTaskIds: materialized.map(slice => normalizePlanBatchValue(slice.taskId)).filter(Boolean),
  };
}

export function mergeArtifactHashIndex(artifactHashes = {}, artifactHash, planBatchId) {
  const normalizedArtifactHash = normalizePlanBatchValue(artifactHash);
  const normalizedPlanBatchId = normalizePlanBatchValue(planBatchId);
  const existingForHash = Array.isArray(artifactHashes[normalizedArtifactHash])
    ? artifactHashes[normalizedArtifactHash]
    : [];
  return {
    ...artifactHashes,
    [normalizedArtifactHash]: Array.from(new Set([...existingForHash, normalizedPlanBatchId].filter(Boolean))),
  };
}

export function mergePlanBatchState(registry, prepared, patch = {}, updatedAt = '') {
  const planBatchId = normalizePlanBatchValue(prepared.planBatchId);
  const artifactHash = normalizePlanBatchValue(prepared.artifactHash);
  const existingBatch = registry.batches?.[planBatchId] ?? {};
  const nextBatch = {
    ...buildPlanBatchBase(prepared),
    ...existingBatch,
    ...patch,
    updatedAt,
  };

  return {
    ...registry,
    batches: {
      ...registry.batches,
      [planBatchId]: nextBatch,
    },
    artifactHashes: mergeArtifactHashIndex(registry.artifactHashes, artifactHash, planBatchId),
  };
}

export function allocatePlanBatchId(planPrefix, artifactHash, registry) {
  const prefix = normalizePlanBatchValue(planPrefix).toLowerCase();
  const hash = shortHash(artifactHash);
  const matcher = new RegExp(`^${prefix}-[0-9a-f]{6}-(\\d{3})$`, 'u');
  let max = 0;
  for (const existingBatchId of Object.keys(registry.batches ?? {})) {
    const match = existingBatchId.match(matcher);
    if (!match) {
      continue;
    }
    max = Math.max(max, toNumber(match[1], 0));
  }
  return `${prefix}-${hash}-${String(max + 1).padStart(3, '0')}`;
}

export function planBatchFailure(code, message) {
  return {
    code,
    message,
  };
}
