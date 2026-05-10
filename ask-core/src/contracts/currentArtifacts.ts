import type { IsoTimestamp, JsonObject, JsonValue, StringMap } from './shared.js';

export interface CurrentRuntimeEventRecord<TPayload extends JsonObject = JsonObject, TMeta extends JsonObject = JsonObject> {
  seq: number;
  type: string;
  ts: IsoTimestamp;
  sessionId: string;
  taskId?: string;
  actor: string;
  payload: TPayload;
  meta: TMeta;
}

export interface CurrentSequenceState {
  nextSeq: number;
}

export interface CurrentProjectionState {
  lastSeq?: number;
  updatedAt?: IsoTimestamp;
  cursorIntegrity?: string;
  [key: string]: JsonValue | undefined;
}

export interface CurrentActiveSession {
  sessionId: string;
  actorId?: string;
  status?: string;
  branch?: string;
  worktree?: string;
  startedAt?: IsoTimestamp;
  updatedAt?: IsoTimestamp;
  [key: string]: JsonValue | undefined;
}

export interface CurrentTaskOrigin {
  type: string;
  taskId?: string;
  runId?: string;
  artifactHash?: string;
  planBatchId?: string;
  sliceIndex?: number;
  sliceId?: string;
  [key: string]: JsonValue | undefined;
}

export interface CurrentTaskRecord {
  taskId: string;
  status: string;
  title: string;
  description?: string;
  origin?: CurrentTaskOrigin;
  acceptanceCriteria?: string[];
  queueClassHint?: string;
  refactorGovernance?: JsonObject | null;
  owner?: string;
  dependencies?: string[];
  createdAt?: IsoTimestamp;
  updatedAt?: IsoTimestamp;
  lastEventSeq?: number;
  lastEventType?: string;
  [key: string]: JsonValue | CurrentTaskOrigin | string[] | JsonObject | null | undefined;
}

export interface CurrentTaskBoardSnapshot {
  tasks: Record<string, CurrentTaskRecord>;
  [key: string]: JsonValue | Record<string, CurrentTaskRecord> | undefined;
}

export interface CurrentPlanBatchSlice {
  taskId: string;
  sliceId: string;
  title: string;
  dependencies?: string[];
  queueClass?: string;
  [key: string]: JsonValue | string[] | undefined;
}

export interface CurrentPlanBatchRecord {
  planBatchId: string;
  artifactHash: string;
  taskId: string;
  runId: string;
  planPrefix: string;
  planTitle: string;
  createdAt?: IsoTimestamp;
  slices: CurrentPlanBatchSlice[];
  [key: string]: JsonValue | CurrentPlanBatchSlice[] | undefined;
}

export interface CurrentPlanBatchRegistry {
  schemaVersion?: number;
  batches: Record<string, CurrentPlanBatchRecord>;
  artifactHashes?: StringMap<string>;
  [key: string]: JsonValue | Record<string, CurrentPlanBatchRecord> | StringMap<string> | undefined;
}
