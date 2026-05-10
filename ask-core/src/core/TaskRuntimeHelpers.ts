import type { AskTaskRecord } from '../contracts/tasks.js';

export type AskTaskRuntimeFreshness = {
  status: string;
  reasonCode: string;
  blockingDependencies: string[];
};

export type AskTaskRuntimeResult<TTask> = {
  ok: true;
  task: TTask;
};

export function normalizeTaskRuntimeValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function createTaskFreshness(input: Partial<AskTaskRuntimeFreshness> = {}): AskTaskRuntimeFreshness {
  return {
    status: normalizeTaskRuntimeValue(input.status) || 'unverified',
    reasonCode: normalizeTaskRuntimeValue(input.reasonCode) || 'verification-not-passed',
    blockingDependencies: Array.isArray(input.blockingDependencies)
      ? input.blockingDependencies.map(value => normalizeTaskRuntimeValue(value)).filter(Boolean)
      : [],
  };
}

export function enrichTaskWithFreshness<TTask extends AskTaskRecord>(
  task: TTask,
  freshness: Partial<AskTaskRuntimeFreshness> = {}
): TTask & { freshness: AskTaskRuntimeFreshness } {
  return {
    ...task,
    freshness: createTaskFreshness(freshness),
  };
}

export function buildTaskCreatedPayload(title: unknown, description: unknown = ''): {
  title: string;
  description: string;
} {
  return {
    title: normalizeTaskRuntimeValue(title),
    description: normalizeTaskRuntimeValue(description),
  };
}

export function buildTaskAssignedPayload(owner: unknown): { owner: string } {
  return {
    owner: normalizeTaskRuntimeValue(owner),
  };
}

export function buildTaskReopenedPayload(reason: unknown = ''): { reason: string } {
  return {
    reason: normalizeTaskRuntimeValue(reason),
  };
}

export function buildTaskDependencyAddedPayload(dependencyTaskId: unknown): { dependencyTaskId: string } {
  return {
    dependencyTaskId: normalizeTaskRuntimeValue(dependencyTaskId),
  };
}

export function okTaskResult<TTask>(task: TTask): AskTaskRuntimeResult<TTask> {
  return {
    ok: true,
    task,
  };
}
