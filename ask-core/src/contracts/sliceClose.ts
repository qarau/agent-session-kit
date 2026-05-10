import type { AskPrePushCheckResult } from './checks.js';
import type { AskArchitectValidationResult } from './governance.js';
import type { JsonObject } from './shared.js';
import type { AskTaskRecord } from './tasks.js';

export interface AskSliceCloseCommitResult {
  sha: string;
  subject: string;
  footer: string;
  stagedFiles: string[];
  attempts: number;
  [key: string]: unknown;
}

export interface AskSliceCloseFullSuiteResult {
  required: boolean;
  command: string;
  args: string[];
  status?: number | null;
  [key: string]: unknown;
}

export interface AskSliceCloseEntropyHistory {
  source: string;
  taskId: string;
  sliceId?: string;
  validationStatus?: string;
  entropyDelta?: number;
  couplingDelta?: number;
  replayabilityRisk?: string;
  architectureScore?: number;
  entropyScore?: number;
  [key: string]: unknown;
}

export interface AskSliceCloseEntropySnapshot {
  entropyScore: number;
  trend: string;
  architectureScore?: number;
  refactorPressure?: string;
  blocking?: boolean;
  entropyDelta?: number;
  couplingDelta?: number;
  replayabilityRisk?: string;
  measuredAt?: string;
  [key: string]: unknown;
}

export interface AskSliceCloseEntropyResult {
  entropy: AskSliceCloseEntropySnapshot;
  history: AskSliceCloseEntropyHistory;
  driftAnalytics: JsonObject;
  metrics: JsonObject;
  [key: string]: unknown;
}

export interface AskSliceCloseSuccessResult {
  ok: true;
  taskId: string;
  task: AskTaskRecord;
  commit: AskSliceCloseCommitResult;
  prePush: AskPrePushCheckResult;
  architect: AskArchitectValidationResult;
  entropy: AskSliceCloseEntropyResult;
  lanes: string[];
  fullSuite: AskSliceCloseFullSuiteResult;
  [key: string]: unknown;
}

export interface AskSliceCloseFailureResult {
  ok: false;
  taskId?: string;
  code: string;
  message?: string;
  task?: AskTaskRecord;
  commit?: AskSliceCloseCommitResult;
  prePush?: AskPrePushCheckResult;
  architect?: AskArchitectValidationResult;
  entropy?: AskSliceCloseEntropyResult;
  lanes?: string[];
  fullSuite?: AskSliceCloseFullSuiteResult;
  stagedFiles?: string[];
  [key: string]: unknown;
}

export type AskSliceCloseResult = AskSliceCloseSuccessResult | AskSliceCloseFailureResult;
