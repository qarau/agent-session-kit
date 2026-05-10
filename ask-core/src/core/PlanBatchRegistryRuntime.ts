import type { AskPlanBatchRegistry, AskPlanBatchRegistryRecord } from '../contracts/tasks.js';
import type { JsonObject } from '../contracts/shared.js';

export type AskPlanBatchRegistryDecision =
  | { ok: true; registry: AskPlanBatchRegistry }
  | { ok: false; code: 'E_PLAN_BATCH_INVALID'; message: string };

type PreparedPlanBatchInput = {
  planBatchId: unknown;
  artifactHash: unknown;
  taskId: unknown;
  runId: unknown;
  artifact?: { path?: unknown };
  planPrefix: unknown;
  planTitle: unknown;
  materialized?: Array<{ taskId?: unknown }>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function shortHash(value: unknown): string {
  return normalizePlanBatchValue(value).replace(/^sha256:/u, '').slice(0, 6);
}

export function normalizePlanBatchValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function normalizePlanBatchRegistry(payload: unknown): AskPlanBatchRegistryDecision {
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
      batches: { ...(payload.batches as Record<string, AskPlanBatchRegistryRecord>) },
      artifactHashes,
    },
  };
}

export function buildPlanBatchBase(prepared: PreparedPlanBatchInput): AskPlanBatchRegistryRecord {
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

export function mergeArtifactHashIndex(
  artifactHashes: Record<string, string[]> = {},
  artifactHash: unknown,
  planBatchId: unknown
): Record<string, string[]> {
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

export function mergePlanBatchState(
  registry: AskPlanBatchRegistry,
  prepared: PreparedPlanBatchInput,
  patch: Partial<AskPlanBatchRegistryRecord> = {},
  updatedAt = ''
): AskPlanBatchRegistry {
  const planBatchId = normalizePlanBatchValue(prepared.planBatchId);
  const artifactHash = normalizePlanBatchValue(prepared.artifactHash);
  const existingBatch = registry.batches?.[planBatchId] ?? {};
  const nextBatch = {
    ...buildPlanBatchBase(prepared),
    ...existingBatch,
    ...patch,
    updatedAt,
  } as AskPlanBatchRegistryRecord;

  return {
    ...registry,
    batches: {
      ...registry.batches,
      [planBatchId]: nextBatch,
    },
    artifactHashes: mergeArtifactHashIndex(registry.artifactHashes, artifactHash, planBatchId),
  };
}

export function allocatePlanBatchId(
  planPrefix: unknown,
  artifactHash: unknown,
  registry: Pick<AskPlanBatchRegistry, 'batches'>
): string {
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

export function planBatchFailure(code: string, message: string): JsonObject {
  return {
    code,
    message,
  };
}
