function withEvent(state, event) {
  return {
    ...state,
    lastEventSeq: Number(event.seq ?? 0),
    lastEventType: String(event.type ?? ''),
    lastEventAt: String(event.ts ?? ''),
  };
}

export class SessionProjector {
  initialState() {
    return {
      sessionId: '',
      status: 'idle',
      goal: '',
      branch: '',
      worktree: '',
      startedAt: '',
      lastActiveAt: '',
      lastHandoffAt: '',
      lastEventSeq: 0,
      lastEventType: '',
      lastEventAt: '',
    };
  }

  apply(state, event) {
    const type = String(event.type ?? '');
    if (type === 'SessionStarted') {
      const next = {
        ...state,
        sessionId: String(event.sessionId ?? state.sessionId),
        status: 'active',
        goal: String(event.payload?.goal ?? state.goal),
        startedAt: state.startedAt || String(event.ts ?? ''),
        lastActiveAt: String(event.ts ?? ''),
      };
      return withEvent(next, event);
    }

    if (type === 'SessionResumed') {
      return withEvent(
        {
          ...state,
          status: 'active',
          lastActiveAt: String(event.ts ?? ''),
        },
        event
      );
    }

    if (type === 'SessionPaused') {
      return withEvent(
        {
          ...state,
          status: 'paused',
          lastActiveAt: String(event.ts ?? ''),
        },
        event
      );
    }

    if (type === 'SessionBlocked') {
      return withEvent(
        {
          ...state,
          status: 'blocked',
          lastActiveAt: String(event.ts ?? ''),
        },
        event
      );
    }

    if (type === 'SessionClosed') {
      return withEvent(
        {
          ...state,
          status: 'closed',
          lastActiveAt: String(event.ts ?? ''),
        },
        event
      );
    }

    if (type === 'SessionHandoffGenerated') {
      return withEvent(
        {
          ...state,
          lastHandoffAt: String(event.ts ?? ''),
        },
        event
      );
    }

    if (type === 'WorktreeVerified') {
      return withEvent(
        {
          ...state,
          branch: String(event.payload?.branch ?? state.branch),
          worktree: String(event.payload?.worktree ?? state.worktree),
        },
        event
      );
    }

    return state;
  }
}
