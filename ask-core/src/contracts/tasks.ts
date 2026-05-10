import type { IsoTimestamp, JsonObject, JsonValue } from './shared.js';
import type { CurrentTaskOrigin } from './currentArtifacts.js';

export type AskTaskStatus = 'created' | 'in-progress' | 'blocked' | 'completed' | 'cancelled' | (string & {});

export interface AskPlanIngestOrigin extends CurrentTaskOrigin {
  type: 'plan-ingest';
  taskId: string;
  runId: string;
  artifactHash: string;
  planBatchId: string;
  sliceIndex: number;
  sliceId: string;
}

export interface AskTaskRecord {
  taskId: string;
  status: AskTaskStatus;
  title: string;
  description?: string;
  origin?: AskPlanIngestOrigin | CurrentTaskOrigin;
  acceptanceCriteria?: string[];
  queueClassHint?: string;
  refactorGovernance?: JsonObject | null;
  owner?: string;
  dependencies?: string[];
  createdAt?: IsoTimestamp;
  updatedAt?: IsoTimestamp;
  lastEventSeq?: number;
  lastEventType?: string;
  [key: string]: JsonValue | AskPlanIngestOrigin | CurrentTaskOrigin | string[] | JsonObject | null | undefined;
}

export interface AskPlanSliceInput {
  sliceId?: string;
  title: string;
  description?: string;
  dependsOn?: string[];
  acceptanceCriteria?: string[];
  queueClass?: string;
  [key: string]: JsonValue | string[] | undefined;
}

export interface AskPlanV2 {
  schemaVersion: 2;
  planPrefix: string;
  planTitle: string;
  planSummary?: string;
  slices: AskPlanSliceInput[];
  [key: string]: JsonValue | AskPlanSliceInput[] | undefined;
}

export interface AskMaterializedPlanSlice {
  taskId: string;
  sliceId: string;
  title: string;
  description?: string;
  dependencies: string[];
  acceptanceCriteria: string[];
  queueClass?: string;
  origin: AskPlanIngestOrigin;
  [key: string]: JsonValue | AskPlanIngestOrigin | string[] | undefined;
}

export interface AskPlanBatchRecord {
  planBatchId: string;
  artifactHash: string;
  taskId: string;
  runId: string;
  planPrefix: string;
  planTitle: string;
  createdAt?: IsoTimestamp;
  slices: AskMaterializedPlanSlice[];
  [key: string]: JsonValue | AskMaterializedPlanSlice[] | undefined;
}

export interface AskPlanBatchRegistryRecord {
  planBatchId: string;
  artifactHash: string;
  taskId: string;
  runId: string;
  artifactPath?: string;
  planPrefix: string;
  planTitle: string;
  sliceCount?: number;
  plannedTaskIds?: string[];
  createdTaskIds?: string[];
  status?: string;
  createdAt?: IsoTimestamp;
  updatedAt?: IsoTimestamp;
  failure?: JsonObject;
  [key: string]: JsonValue | string[] | JsonObject | undefined;
}

export interface AskPlanBatchRegistry {
  schemaVersion: number;
  batches: Record<string, AskPlanBatchRegistryRecord>;
  artifactHashes: Record<string, string[]>;
  [key: string]: JsonValue | Record<string, AskPlanBatchRegistryRecord> | Record<string, string[]> | undefined;
}
