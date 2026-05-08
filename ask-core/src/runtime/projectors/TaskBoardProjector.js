function normalizeTaskId(event) {
  const taskId = String(event.taskId ?? '').trim();
  return taskId;
}

function createTaskBase(taskId, event, previous) {
  return {
    taskId,
    status: previous?.status ?? 'created',
    title: String(previous?.title ?? ''),
    description: String(previous?.description ?? ''),
    origin: previous?.origin && typeof previous.origin === 'object' ? { ...previous.origin } : null,
    acceptanceCriteria: Array.isArray(previous?.acceptanceCriteria) ? [...previous.acceptanceCriteria] : [],
    queueClassHint: String(previous?.queueClassHint ?? ''),
    refactorGovernance: previous?.refactorGovernance && typeof previous.refactorGovernance === 'object'
      ? { ...previous.refactorGovernance }
      : null,
    owner: String(previous?.owner ?? ''),
    dependencies: Array.isArray(previous?.dependencies) ? [...previous.dependencies] : [],
    createdAt: previous?.createdAt || String(event.ts ?? ''),
    updatedAt: String(event.ts ?? ''),
    lastEventSeq: Number(event.seq ?? 0),
    lastEventType: String(event.type ?? ''),
  };
}

function withTask(state, taskId, task) {
  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: task,
    },
  };
}

export class TaskBoardProjector {
  initialState() {
    return { tasks: {} };
  }

  apply(state, event) {
    const taskId = normalizeTaskId(event);
    if (!taskId) {
      return state;
    }

    const current = state.tasks[taskId];
    const base = createTaskBase(taskId, event, current);
    const type = String(event.type ?? '');

    if (type === 'TaskCreated') {
      const origin = event.payload?.origin && typeof event.payload.origin === 'object'
        ? { ...event.payload.origin }
        : base.origin;
      const acceptanceCriteria = Array.isArray(event.payload?.acceptanceCriteria)
        ? event.payload.acceptanceCriteria.map(value => String(value ?? '').trim()).filter(Boolean)
        : base.acceptanceCriteria;
      const refactorGovernance = origin?.type === 'ohder-refactor-governance'
        ? {
          recommendationFingerprint: String(origin.recommendationFingerprint ?? ''),
          targetId: String(origin.targetId ?? ''),
          confidence: String(origin.confidence ?? ''),
          approvalRequired: origin.approvalRequired === true,
          approvalStatus: origin.approvalRequired === true ? 'pending' : 'not-required',
          approvedBy: '',
          rejectedReason: '',
          executionPlan: origin.refactorExecutionPlan && typeof origin.refactorExecutionPlan === 'object'
            ? { ...origin.refactorExecutionPlan }
            : null,
        }
        : base.refactorGovernance;
      return withTask(state, taskId, {
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
      return withTask(state, taskId, {
        ...base,
        owner: String(event.payload?.owner ?? base.owner),
      });
    }

    if (type === 'TaskStarted') {
      return withTask(state, taskId, {
        ...base,
        status: 'in-progress',
      });
    }

    if (type === 'TaskCompleted') {
      return withTask(state, taskId, {
        ...base,
        status: 'completed',
      });
    }

    if (type === 'TaskReopened') {
      return withTask(state, taskId, {
        ...base,
        status: 'in-progress',
      });
    }

    if (type === 'TaskBlocked') {
      return withTask(state, taskId, {
        ...base,
        status: 'blocked',
      });
    }

    if (type === 'RefactorApproved') {
      return withTask(state, taskId, {
        ...base,
        refactorGovernance: {
          ...(base.refactorGovernance ?? {}),
          approvalStatus: 'approved',
          approvalRequired: false,
          approvedBy: String(event.payload?.approvedBy ?? ''),
          approvedAt: String(event.ts ?? ''),
        },
      });
    }

    if (type === 'RefactorRejected') {
      return withTask(state, taskId, {
        ...base,
        status: 'blocked',
        refactorGovernance: {
          ...(base.refactorGovernance ?? {}),
          approvalStatus: 'rejected',
          rejectedReason: String(event.payload?.reason ?? ''),
          rejectedAt: String(event.ts ?? ''),
        },
      });
    }

    if (type === 'TaskDependencyAdded') {
      const dependencyTaskId = String(event.payload?.dependencyTaskId ?? '').trim();
      const dependencies = new Set(base.dependencies);
      if (dependencyTaskId) {
        dependencies.add(dependencyTaskId);
      }
      return withTask(state, taskId, {
        ...base,
        dependencies: Array.from(dependencies).sort(),
      });
    }

    return state;
  }
}
