# Agent Session Laws

Use this as the non-negotiable baseline for agent-driven development.

## Law 1: Session Docs Are Control Plane

`docs/session/**` is operational state, not optional notes.

## Law 2: Freshness Is Always-On

Every meaningful work cycle must update:

- `docs/session/current-status.md`
- `docs/session/change-log.md`

Also keep `docs/session/tasks.md` current for task-level visibility.
Update `docs/session/open-loops.md` when decisions/risks/scope change.

## Law 3: Evidence Before Claims

No completion claims without fresh verification output recorded in `change-log.md`.

## Law 4: Context Lock

Active branch/worktree must match `docs/session/active-work-context.json`.

## Law 5: Hook Enforcement

Pre-commit and pre-push checks are mandatory:

- work context validator
- session freshness validator

## Law 6: Explicit Bypass

Emergency bypass must be explicit and auditable:

- `SESSION_CONTEXT_BYPASS=1`
- `SESSION_DOCS_BYPASS=1`

## Law 7: Atomic Cycle Completion

A meaningful cycle is complete only when:

1. Behavior/tests/docs are updated.
2. Verification passes.
3. Session docs are fresh.
4. Commit is created.

## Law 8: Task Board Continuity

`docs/session/tasks.md` should always answer:

1. What is in progress now.
2. What is next.
3. What was completed.
