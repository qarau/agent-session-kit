import type { IsoTimestamp, JsonObject } from './shared.js';
import type { AskTaskRecord } from './tasks.js';

export type AskWorkerRole = 'orchestrator' | 'builder' | 'validator' | 'committer' | 'projector';
export type AskWorkerExecutionStatus = 'planned' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';

export interface AskWorkerAssignment {
  assignmentId: string;
  taskId: string;
  role: AskWorkerRole;
  status: AskWorkerExecutionStatus;
  workerId?: string;
  task?: AskTaskRecord;
  requiredCapabilities: string[];
  claimedFiles: string[];
  startedAt?: IsoTimestamp;
  completedAt?: IsoTimestamp;
  metadata?: JsonObject;
}
