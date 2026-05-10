import {
  approvedRefactorGovernance,
  createdRefactorGovernance,
  rejectedRefactorGovernance,
} from './RefactorTaskGovernance.js';
import {
  cloneTaskBoardObject,
  createTaskBoardBase,
  mergeTaskBoardDependencies,
  normalizeAcceptanceCriteria,
  normalizeTaskBoardTaskId,
  withTaskBoardTask,
} from './TaskBoardProjectorHelpers.js';

export class TaskBoardProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalizeTaskBoardTaskId(event.taskId);
    if (!taskId) {
      return state;
    }

    const current = state.tasks[taskId];
    const base = createTaskBoardBase(taskId, event, current);
    const type = String(event.type ?? '');

    if (type === 'TaskCreated') {
      const origin = cloneTaskBoardObject(event.payload?.origin) ?? base.origin;
      const acceptanceCriteria = Array.isArray(event.payload?.acceptanceCriteria)
        ? normalizeAcceptanceCriteria(event.payload.acceptanceCriteria)
        : base.acceptanceCriteria;
      const refactorGovernance = createdRefactorGovernance(origin, base.refactorGovernance);
      return withTaskBoardTask(state, taskId, {
        ...base,
        status: 'created',
        title: String(event.payload?.title ?? base.title),
        description: String(event.payload?.description ?? base.description),
        origin,
        acceptanceCriteria,
        queueClassHint: String(event.payload?.queueClassHint ?? base.queueClassHint),
        refactorGovernance,
      });
    }

    if (type === 'TaskAssigned') {
      return withTaskBoardTask(state, taskId, {
        ...base,
        owner: String(event.payload?.owner ?? base.owner),
      });
    }

    if (type === 'TaskStarted') {
      return withTaskBoardTask(state, taskId, {
        ...base,
        status: 'in-progress',
      });
    }

    if (type === 'TaskCompleted') {
      return withTaskBoardTask(state, taskId, {
        ...base,
        status: 'completed',
      });
    }

    if (type === 'TaskReopened') {
      return withTaskBoardTask(state, taskId, {
        ...base,
        status: 'in-progress',
      });
    }

    if (type === 'TaskBlocked') {
      return withTaskBoardTask(state, taskId, {
        ...base,
        status: 'blocked',
      });
    }

    if (type === 'RefactorApproved') {
      return withTaskBoardTask(state, taskId, {
        ...base,
        refactorGovernance: approvedRefactorGovernance(base.refactorGovernance, event),
      });
    }

    if (type === 'RefactorRejected') {
      return withTaskBoardTask(state, taskId, {
        ...base,
        status: 'blocked',
        refactorGovernance: rejectedRefactorGovernance(base.refactorGovernance, event),
      });
    }

    if (type === 'TaskDependencyAdded') {
      return withTaskBoardTask(state, taskId, {
        ...base,
        dependencies: mergeTaskBoardDependencies(base.dependencies, event.payload?.dependencyTaskId),
      });
    }

    return state;
  }
}
