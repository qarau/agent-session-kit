import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Scaffolder } from '../fs/Scaffolder.js';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { QueueClassRegistry } from '../policy/QueueClassRegistry.js';
import {
  allocatePlanBatchId as allocatePlanBatchRegistryId,
  buildPlanBatchBase,
  mergePlanBatchState,
  normalizePlanBatchRegistry,
} from './PlanBatchRegistryRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(entry => normalize(entry)).filter(Boolean);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function buildHash(text) {
  return `sha256:${crypto.createHash('sha256').update(String(text), 'utf8').digest('hex')}`;
}

function parsePlanJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function validatePlanShape(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail('E_PLAN_SCHEMA_INVALID', 'plan payload must be a JSON object');
  }
  if (toNumber(payload.schemaVersion, 0) !== 2) {
    return fail('E_PLAN_SCHEMA_UNSUPPORTED', `unsupported schemaVersion: ${String(payload.schemaVersion ?? '')}`);
  }
  if (!normalize(payload.planPrefix)) {
    return fail('E_PLAN_SCHEMA_INVALID', 'planPrefix is required');
  }
  if (!/^[a-z][a-z0-9-]*$/u.test(normalize(payload.planPrefix).toLowerCase())) {
    return fail('E_PLAN_SCHEMA_INVALID', 'planPrefix must match ^[a-z][a-z0-9-]*$');
  }
  if (!normalize(payload.planTitle)) {
    return fail('E_PLAN_SCHEMA_INVALID', 'planTitle is required');
  }
  if (!Array.isArray(payload.slices)) {
    return fail('E_PLAN_SCHEMA_INVALID', 'slices must be an array');
  }
  if (payload.slices.length < 1) {
    return fail('E_PLAN_EMPTY', 'slices must include at least one entry');
  }
  return { ok: true };
}

function detectCycle(graph) {
  const visited = new Set();
  const stack = new Set();

  function dfs(node) {
    if (stack.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visited.add(node);
    stack.add(node);
    const deps = graph.get(node) ?? [];
    for (const dep of deps) {
      if (dfs(dep)) {
        return true;
      }
    }
    stack.delete(node);
    return false;
  }

  for (const key of graph.keys()) {
    if (dfs(key)) {
      return true;
    }
  }
  return false;
}

export class PlanIngestRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.scaffolder = new Scaffolder(cwd);
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.queueClasses = new QueueClassRegistry();
  }

  async readWorkflowSnapshot() {
    return this.store.readJson(this.paths.workflowSnapshot(), { tasks: {} });
  }

  async readTaskSnapshot() {
    return this.store.readJson(this.paths.taskBoardSnapshot(), { tasks: {} });
  }

  async readBatchRegistry() {
    const payload = await this.store.readJson(this.paths.planBatchRegistry(), {
      schemaVersion: 1,
      batches: {},
      artifactHashes: {},
    });
    const decision = normalizePlanBatchRegistry(payload);
    if (!decision.ok) {
      return fail(decision.code, decision.message);
    }
    return decision;
  }

  buildBatchBase(prepared) {
    return buildPlanBatchBase(prepared);
  }

  async writeBatchState(prepared, patch = {}) {
    const registryDecision = await this.readBatchRegistry();
    const registry = registryDecision.ok ? registryDecision.registry : prepared.registry;
    const nextRegistry = mergePlanBatchState(registry, prepared, patch, nowIso());
    await this.store.writeJson(this.paths.planBatchRegistry(), nextRegistry);
    return nextRegistry;
  }

  resolvePlanArtifact(workflow, taskId, runId, pathOverride = '') {
    const task = workflow.tasks?.[taskId];
    const run = task?.runs?.[runId];
    const artifacts = Array.isArray(run?.artifacts) ? run.artifacts : [];
    const candidates = artifacts
      .filter(artifact => normalize(artifact?.type).toLowerCase() === 'plan')
      .filter(artifact => !pathOverride || normalize(artifact?.path) === pathOverride);
    if (candidates.length < 1) {
      return fail('E_PLAN_ARTIFACT_NOT_FOUND', `plan artifact not found for task=${taskId} run=${runId}`);
    }
    const sorted = [...candidates].sort((left, right) => toNumber(right.seq, 0) - toNumber(left.seq, 0));
    const selected = sorted[0];
    const resolvedPath = path.resolve(this.cwd, normalize(selected.path));
    if (!fs.existsSync(resolvedPath)) {
      return fail('E_PLAN_ARTIFACT_NOT_FOUND', `plan artifact path does not exist: ${normalize(selected.path)}`);
    }
    return {
      ok: true,
      artifact: {
        type: 'plan',
        path: normalize(selected.path),
        absolutePath: resolvedPath,
        seq: toNumber(selected.seq, 0),
      },
    };
  }

  validateAndNormalizeSlices(plan) {
    const explicitSliceIds = new Set();
    const sliceById = new Map();
    const normalizedSlices = [];

    for (let index = 0; index < plan.slices.length; index += 1) {
      const slice = plan.slices[index];
      if (!slice || typeof slice !== 'object' || Array.isArray(slice)) {
        return fail('E_PLAN_SCHEMA_INVALID', `slice at index ${String(index)} must be an object`);
      }
      const title = normalize(slice.title);
      if (!title) {
        return fail('E_PLAN_SCHEMA_INVALID', `slice at index ${String(index)} is missing title`);
      }
      const sliceId = normalize(slice.sliceId);
      if (sliceId) {
        if (explicitSliceIds.has(sliceId)) {
          return fail('E_PLAN_SLICE_DUPLICATE', `duplicate sliceId: ${sliceId}`);
        }
        explicitSliceIds.add(sliceId);
      }
      const dependsOnRaw = slice.dependsOn;
      if (dependsOnRaw !== undefined && !Array.isArray(dependsOnRaw)) {
        return fail('E_PLAN_SCHEMA_INVALID', `dependsOn must be an array for slice ${sliceId || String(index + 1)}`);
      }
      const acceptanceCriteriaRaw = slice.acceptanceCriteria;
      if (acceptanceCriteriaRaw !== undefined && !Array.isArray(acceptanceCriteriaRaw)) {
        return fail('E_PLAN_SCHEMA_INVALID', `acceptanceCriteria must be an array for slice ${sliceId || String(index + 1)}`);
      }
      const queueClass = normalize(slice.queueClass).toLowerCase();
      if (queueClass && !this.queueClasses.has(queueClass)) {
        return fail('E_PLAN_SCHEMA_INVALID', `invalid queueClass for slice ${sliceId || String(index + 1)}: ${queueClass}`);
      }
      const ref = sliceId || `__index_${String(index + 1)}`;
      const normalizedSlice = {
        index,
        ref,
        sliceId,
        title,
        description: normalize(slice.description),
        dependsOn: dependsOnRaw === undefined ? null : normalizeArray(dependsOnRaw),
        acceptanceCriteria: normalizeArray(acceptanceCriteriaRaw),
        queueClass,
      };
      normalizedSlices.push(normalizedSlice);
      if (sliceId) {
        sliceById.set(sliceId, normalizedSlice);
      }
    }

    const dependencyGraph = new Map();
    for (let index = 0; index < normalizedSlices.length; index += 1) {
      const current = normalizedSlices[index];
      const dependencies = [];
      if (Array.isArray(current.dependsOn)) {
        for (const dependencySliceId of current.dependsOn) {
          const dep = sliceById.get(dependencySliceId);
          if (!dep) {
            return fail('E_PLAN_DEPENDENCY_UNKNOWN', `unknown dependency ${dependencySliceId} for slice ${current.sliceId || String(current.index + 1)}`);
          }
          dependencies.push(dep.ref);
        }
      } else if (index > 0) {
        dependencies.push(normalizedSlices[index - 1].ref);
      }
      dependencyGraph.set(current.ref, dependencies);
    }

    if (detectCycle(dependencyGraph)) {
      return fail('E_PLAN_DEPENDENCY_CYCLE', 'dependency graph contains a cycle');
    }

    return {
      ok: true,
      normalizedSlices,
      dependencyGraph,
    };
  }

  allocateTaskIds(planPrefix, normalizedSlices, existingTaskIds) {
    const lowerPrefix = normalize(planPrefix).toLowerCase();
    if (!lowerPrefix) {
      return fail('E_PLAN_SCHEMA_INVALID', 'planPrefix is required');
    }
    const matcher = new RegExp(`^${lowerPrefix}-(\\d+)$`, 'u');
    let maxId = 0;
    let width = 3;
    const existingSet = new Set(existingTaskIds.map(id => normalize(id)));
    for (const taskId of existingSet) {
      const match = taskId.toLowerCase().match(matcher);
      if (!match) {
        continue;
      }
      const value = toNumber(match[1], 0);
      if (value > maxId) {
        maxId = value;
      }
      width = Math.max(width, String(match[1]).length);
    }

    const allocated = [];
    const seen = new Set(existingSet);
    for (let index = 0; index < normalizedSlices.length; index += 1) {
      const value = maxId + index + 1;
      const taskId = `${lowerPrefix}-${String(value).padStart(width, '0')}`;
      if (seen.has(taskId)) {
        return fail('E_PLAN_ID_COLLISION', `task id allocation collision: ${taskId}`);
      }
      seen.add(taskId);
      allocated.push(taskId);
    }
    return { ok: true, allocated };
  }

  allocatePlanBatchId(planPrefix, artifactHash, registry) {
    return allocatePlanBatchRegistryId(planPrefix, artifactHash, registry);
  }

  buildIngestGraph(normalizedSlices, dependencyGraph, allocatedIds) {
    const byRef = new Map();
    for (let index = 0; index < normalizedSlices.length; index += 1) {
      const slice = normalizedSlices[index];
      byRef.set(slice.ref, {
        ...slice,
        taskId: allocatedIds[index],
      });
    }
    const materialized = [];
    for (const slice of normalizedSlices) {
      const node = byRef.get(slice.ref);
      const depRefs = dependencyGraph.get(slice.ref) ?? [];
      const dependencyTaskIds = depRefs.map(ref => byRef.get(ref)?.taskId).filter(Boolean);
      materialized.push({
        ...node,
        dependencyTaskIds,
      });
    }
    return materialized;
  }

  async appendRuntimeEvent(type, sessionId, actor, taskId, payload, meta = {}) {
    await this.ledger.append({
      type,
      sessionId,
      taskId,
      actor,
      payload,
      meta: {
        source: 'plan-ingest-runtime',
        schemaVersion: 1,
        ...meta,
      },
    });
    await this.projectionEngine.projectIncremental();
  }

  async prepare(taskId, runId, options = {}) {
    const resolvedTaskId = normalize(taskId);
    const resolvedRunId = normalize(runId);
    const pathOverride = normalize(options.path);

    if (!resolvedTaskId) {
      return fail('E_PLAN_SCHEMA_INVALID', 'task id is required');
    }
    if (!resolvedRunId) {
      return fail('E_PLAN_SCHEMA_INVALID', 'run id is required');
    }

    const workflow = await this.readWorkflowSnapshot();
    const artifactResult = this.resolvePlanArtifact(workflow, resolvedTaskId, resolvedRunId, pathOverride);
    if (!artifactResult.ok) {
      return artifactResult;
    }

    const raw = fs.readFileSync(artifactResult.artifact.absolutePath, 'utf8');
    const parsed = parsePlanJson(raw);
    if (!parsed) {
      return fail('E_PLAN_SCHEMA_INVALID', 'plan artifact is not valid JSON');
    }
    const shapeDecision = validatePlanShape(parsed);
    if (!shapeDecision.ok) {
      return shapeDecision;
    }

    const sliceDecision = this.validateAndNormalizeSlices(parsed);
    if (!sliceDecision.ok) {
      return sliceDecision;
    }

    const artifactHash = buildHash(raw);
    const registryDecision = await this.readBatchRegistry();
    if (!registryDecision.ok) {
      return registryDecision;
    }
    const registry = registryDecision.registry;
    const existingForHash = Array.isArray(registry.artifactHashes[artifactHash])
      ? registry.artifactHashes[artifactHash]
      : [];
    if (existingForHash.length > 0 && options.forceNewBatch !== true) {
      return fail('E_PLAN_DUPLICATE_INGEST', `plan artifact already ingested: ${artifactHash}`, {
        artifactHash,
        existingBatches: existingForHash,
      });
    }

    const taskSnapshot = await this.readTaskSnapshot();
    const existingTaskIds = Object.keys(taskSnapshot.tasks ?? {});
    const allocateDecision = this.allocateTaskIds(parsed.planPrefix, sliceDecision.normalizedSlices, existingTaskIds);
    if (!allocateDecision.ok) {
      return allocateDecision;
    }

    const planBatchId = this.allocatePlanBatchId(parsed.planPrefix, artifactHash, registry);
    const materialized = this.buildIngestGraph(
      sliceDecision.normalizedSlices,
      sliceDecision.dependencyGraph,
      allocateDecision.allocated
    );

    return {
      ok: true,
      taskId: resolvedTaskId,
      runId: resolvedRunId,
      artifact: artifactResult.artifact,
      artifactHash,
      planBatchId,
      planPrefix: normalize(parsed.planPrefix).toLowerCase(),
      planTitle: normalize(parsed.planTitle),
      materialized,
      registry,
    };
  }

  async validate(taskId, runId, options = {}) {
    await this.scaffolder.init();
    const prepared = await this.prepare(taskId, runId, {
      path: options.path,
      forceNewBatch: options.forceNewBatch === true,
    });
    if (!prepared.ok) {
      return prepared;
    }

    return {
      ok: true,
      taskId: prepared.taskId,
      runId: prepared.runId,
      artifact: prepared.artifact,
      artifactHash: prepared.artifactHash,
      planBatchId: prepared.planBatchId,
      planPrefix: prepared.planPrefix,
      planTitle: prepared.planTitle,
      sliceCount: prepared.materialized.length,
      slices: prepared.materialized.map(slice => ({
        taskId: slice.taskId,
        sliceId: slice.sliceId,
        title: slice.title,
        dependencies: slice.dependencyTaskIds,
        queueClass: slice.queueClass,
      })),
      dryRun: options.dryRun === true,
    };
  }

  async ingest(taskId, runId, options = {}) {
    await this.scaffolder.init();
    const prepared = await this.prepare(taskId, runId, {
      path: options.path,
      forceNewBatch: options.forceNewBatch === true,
    });
    if (!prepared.ok) {
      return prepared;
    }

    if (options.dryRun === true) {
      return this.validate(taskId, runId, {
        path: options.path,
        forceNewBatch: options.forceNewBatch === true,
        dryRun: true,
      });
    }

    const activeSession = await this.store.readJson(this.paths.activeSession(), {
      sessionId: '',
      actorId: 'local',
    });
    const sessionId = normalize(activeSession.sessionId);
    const actor = normalize(activeSession.actorId) || 'local';

    const createdTaskIds = [];
    const dependencyGraph = {};

    await this.writeBatchState(prepared, {
      status: 'pending',
      createdTaskIds,
      dependencyGraph,
      createdAt: nowIso(),
    });

    try {
      await this.appendRuntimeEvent('PlanIngested', sessionId, actor, prepared.taskId, {
        planBatchId: prepared.planBatchId,
        taskId: prepared.taskId,
        runId: prepared.runId,
        artifactPath: prepared.artifact.path,
        artifactHash: prepared.artifactHash,
        planPrefix: prepared.planPrefix,
        planTitle: prepared.planTitle,
        sliceCount: prepared.materialized.length,
      });

      for (let index = 0; index < prepared.materialized.length; index += 1) {
        const slice = prepared.materialized[index];
        const origin = {
          type: 'plan-ingest',
          taskId: prepared.taskId,
          runId: prepared.runId,
          artifactHash: prepared.artifactHash,
          planBatchId: prepared.planBatchId,
          sliceIndex: index + 1,
          sliceId: slice.sliceId,
        };
        await this.appendRuntimeEvent('TaskCreated', sessionId, actor, slice.taskId, {
          title: slice.title,
          description: slice.description,
          acceptanceCriteria: slice.acceptanceCriteria,
          queueClassHint: slice.queueClass,
          origin,
        });
        await this.appendRuntimeEvent('PlanSliceMaterialized', sessionId, actor, slice.taskId, {
          planBatchId: prepared.planBatchId,
          sourceTaskId: prepared.taskId,
          sourceRunId: prepared.runId,
          sourceSliceId: slice.sliceId,
          materializedTaskId: slice.taskId,
        });
        if (slice.queueClass) {
          await this.appendRuntimeEvent('TaskClassified', sessionId, actor, slice.taskId, {
            queueClass: slice.queueClass,
          });
        }
        createdTaskIds.push(slice.taskId);
        dependencyGraph[slice.taskId] = [...slice.dependencyTaskIds];
      }

      for (const slice of prepared.materialized) {
        for (const dependencyTaskId of slice.dependencyTaskIds) {
          await this.appendRuntimeEvent('TaskDependencyAdded', sessionId, actor, slice.taskId, {
            dependencyTaskId,
          });
        }
      }

      await this.writeBatchState(prepared, {
        status: 'completed',
        createdTaskIds,
        dependencyGraph,
        completedAt: nowIso(),
      });
    } catch (error) {
      const message = normalize(error?.message || String(error));
      await this.writeBatchState(prepared, {
        status: 'failed',
        createdTaskIds,
        dependencyGraph,
        failure: {
          code: 'E_PLAN_INGEST_FAILED',
          message,
        },
        failedAt: nowIso(),
      });
      return fail('E_PLAN_INGEST_FAILED', message || 'plan ingest failed during materialization', {
        taskId: prepared.taskId,
        runId: prepared.runId,
        planBatchId: prepared.planBatchId,
        artifactHash: prepared.artifactHash,
        createdTaskIds,
      });
    }

    return {
      ok: true,
      taskId: prepared.taskId,
      runId: prepared.runId,
      planBatchId: prepared.planBatchId,
      artifactHash: prepared.artifactHash,
      createdTaskIds,
      sliceCount: prepared.materialized.length,
      nextAction: 'ask next',
    };
  }

  async batchShow(planBatchId) {
    await this.scaffolder.init();
    const resolvedBatchId = normalize(planBatchId);
    if (!resolvedBatchId) {
      return fail('E_PLAN_SCHEMA_INVALID', 'planBatchId is required');
    }
    const decision = await this.readBatchRegistry();
    if (!decision.ok) {
      return decision;
    }
    const batch = decision.registry.batches?.[resolvedBatchId];
    if (!batch) {
      return fail('E_PLAN_BATCH_INVALID', `plan batch not found: ${resolvedBatchId}`, {
        planBatchId: resolvedBatchId,
      });
    }
    return {
      ok: true,
      batch,
    };
  }
}
