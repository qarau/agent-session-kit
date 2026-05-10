import type { IsoTimestamp, JsonObject } from '../../contracts/shared.js';

export type AskTaskBoardProjectionEvent = {
  seq?: number;
  ts?: IsoTimestamp | string;
  type?: string;
  taskId?: unknown;
  payload?: Record<string, unknown>;
};

export type AskTaskBoardProjectionTask = {
  taskId: string;
  status: string;
  title: string;
  description: string;
  origin: JsonObject | null;
  acceptanceCriteria: string[];
  queueClassHint: string;
  refactorGovernance: JsonObject | null;
  owner: string;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
  lastEventSeq: number;
  lastEventType: string;
};

export type AskTaskBoardProjectionState = {
  tasks: Record<string, AskTaskBoardProjectionTask>;
};

export function normalizeTaskBoardTaskId(value: unknown): string {
  return String(value ?? '').trim();
}

export function cloneTaskBoardObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as JsonObject) }
    : null;
}

export function normalizeAcceptanceCriteria(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(entry => String(entry ?? '').trim()).filter(Boolean)
    : [];
}

export function createTaskBoardBase(
  taskId: string,
  event: AskTaskBoardProjectionEvent,
  previous?: Partial<AskTaskBoardProjectionTask>
): AskTaskBoardProjectionTask {
  return {
    taskId,
    status: previous?.status ?? 'created',
    title: String(previous?.title ?? ''),
    description: String(previous?.description ?? ''),
    origin: cloneTaskBoardObject(previous?.origin),
    acceptanceCriteria: Array.isArray(previous?.acceptanceCriteria) ? [...previous.acceptanceCriteria] : [],
    queueClassHint: String(previous?.queueClassHint ?? ''),
    refactorGovernance: cloneTaskBoardObject(previous?.refactorGovernance),
    owner: String(previous?.owner ?? ''),
    dependencies: Array.isArray(previous?.dependencies) ? [...previous.dependencies] : [],
    createdAt: previous?.createdAt || String(event.ts ?? ''),
    updatedAt: String(event.ts ?? ''),
    lastEventSeq: Number(event.seq ?? 0),
    lastEventType: String(event.type ?? ''),
  };
}

export function withTaskBoardTask(
  state: AskTaskBoardProjectionState,
  taskId: string,
  task: AskTaskBoardProjectionTask
): AskTaskBoardProjectionState {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: task,
    },
  };
}

export function mergeTaskBoardDependencies(previous: readonly string[] = [], dependencyTaskId: unknown): string[] {
  const dependencies = new Set(previous);
  const normalizedDependencyTaskId = normalizeTaskBoardTaskId(dependencyTaskId);
  if (normalizedDependencyTaskId) {
    dependencies.add(normalizedDependencyTaskId);
  }
  return Array.from(dependencies).sort();
}
