import type { IsoTimestamp, JsonObject, JsonValue } from './shared.js';

export type AskRuntimeEventType =
  | 'SessionStarted'
  | 'SessionPaused'
  | 'SessionResumed'
  | 'SessionBlocked'
  | 'SessionClosed'
  | 'TaskCreated'
  | 'TaskAssigned'
  | 'TaskStarted'
  | 'TaskCompleted'
  | 'TaskReopened'
  | 'TaskDependencyAdded'
  | 'PlanModeHandoffCreated'
  | 'PlanModeHandoffValidated'
  | 'PlanModeHandoffIngested'
  | 'ArchitectValidationCompleted'
  | 'ArchitectureScoreCalculated'
  | 'EntropyImpactMeasured'
  | 'OhderFindingDetected'
  | 'OhderFindingReviewed'
  | 'OhderFindingExplained'
  | 'OhderFindingResolved'
  | 'OhderFindingSuppressed'
  | 'OhderFindingExempted'
  | 'OhderFindingAcceptedRisk'
  | 'OhderLawTuningRequested'
  | 'OhderAnalyzerTuningRequested'
  | (string & {});

export interface AskRuntimeEvent<TType extends AskRuntimeEventType = AskRuntimeEventType, TPayload = JsonObject, TMeta = JsonObject> {
  seq: number;
  type: TType;
  ts: IsoTimestamp;
  sessionId: string;
  taskId?: string;
  actor: string;
  payload: TPayload;
  meta: TMeta;
}

export interface TaskCreatedPayload {
  title: string;
  description?: string;
}

export interface TaskStartedPayload {
  [key: string]: JsonValue;
}

export interface TaskCompletedPayload {
  [key: string]: JsonValue;
}

export interface PlanModeHandoffIngestedPayload {
  status: 'ingested' | string;
  title: string;
  taskId: string;
  runId: string;
  workflow: string;
  skill: string;
  sourceMarkdownPath: string;
  planJsonPath: string;
  planBatchId: string;
  artifactHash: string;
  createdTaskIds: string[];
  nextTaskId?: string;
  updatedAt?: IsoTimestamp;
}

export interface ArchitectValidationCompletedPayload {
  taskId: string;
  sliceId: string;
  status: string;
  blocking: boolean;
  lawOutcome?: string;
  lawViolations?: JsonValue[];
  entropyDelta?: number;
  couplingDelta?: number;
  replayabilityRisk?: string;
}

export interface EntropyImpactMeasuredPayload {
  taskId: string;
  sliceId: string;
  entropy: JsonObject;
  history: JsonObject;
}

export interface OhderFindingDetectedPayload {
  findingId?: string;
  finding?: JsonObject;
  findings?: JsonObject[];
  metric?: string;
  severity?: string;
  evidence?: JsonValue[];
  [key: string]: JsonValue | undefined;
}

export type TaskCreatedEvent = AskRuntimeEvent<'TaskCreated', TaskCreatedPayload>;
export type TaskStartedEvent = AskRuntimeEvent<'TaskStarted', TaskStartedPayload>;
export type TaskCompletedEvent = AskRuntimeEvent<'TaskCompleted', TaskCompletedPayload>;
export type PlanModeHandoffIngestedEvent = AskRuntimeEvent<'PlanModeHandoffIngested', PlanModeHandoffIngestedPayload>;
export type ArchitectValidationCompletedEvent = AskRuntimeEvent<'ArchitectValidationCompleted', ArchitectValidationCompletedPayload>;
export type EntropyImpactMeasuredEvent = AskRuntimeEvent<'EntropyImpactMeasured', EntropyImpactMeasuredPayload>;
export type OhderFindingDetectedEvent = AskRuntimeEvent<'OhderFindingDetected', OhderFindingDetectedPayload>;

export type KnownAskRuntimeEvent =
  | TaskCreatedEvent
  | TaskStartedEvent
  | TaskCompletedEvent
  | PlanModeHandoffIngestedEvent
  | ArchitectValidationCompletedEvent
  | EntropyImpactMeasuredEvent
  | OhderFindingDetectedEvent;
