import type { IsoTimestamp, JsonObject } from './shared.js';

export const ASK_QUEUE_CLASSES = [
  'planner',
  'implementer',
  'verifier',
  'debugger',
  'integrator',
  'reviewer',
] as const;

export type AskQueueClass = typeof ASK_QUEUE_CLASSES[number];

export interface AskQueueClassHistoryEntry {
  queueClass: AskQueueClass;
  reason?: string;
  assignedAt: IsoTimestamp;
  metadata?: JsonObject;
}

export interface AskQueueAssignment {
  taskId: string;
  queueClass: AskQueueClass;
  latestClass: AskQueueClass;
  history: AskQueueClassHistoryEntry[];
}
