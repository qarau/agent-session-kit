# Guardrails

## Session Laws

See `docs/session/AGENT_SESSION_LAWS.md`.

## Branch/Worktree Enforcement

- Active context file: `docs/session/active-work-context.json`
- Validator: `node scripts/session/verifyWorkContext.mjs --mode=preflight`
- Hook scripts:
  - `.githooks/pre-commit`
  - `.githooks/pre-push`
- Install hooks:
  - `node scripts/session/installHooks.mjs`
  - verify: `git config --get core.hooksPath` (must be `.githooks`)

Optional repo-level lock:

- `node scripts/session/setRepoWorkContextLock.mjs --branch <branch-name> --repo-suffix <path-suffix> --enforce-path-suffix true`
- `node scripts/session/clearRepoWorkContextLock.mjs`

When enabled, `verifyWorkContext` uses `session.workContextLock.*` values from git config before reading file expectations.

## Session Docs Freshness (Always-On)

For every meaningful cycle, update:

1. `docs/session/current-status.md`
2. `docs/session/change-log.md`
3. `docs/session/tasks.md` to keep Now/Next/Done accurate
4. `docs/session/open-loops.md` when decisions/risks/scope changed

Active log maintenance:

- Run `node scripts/session/archiveSessionLog.mjs --keep-sections 14` after major milestones or when `change-log.md` becomes hard to scan.
- Archived history is stored under `docs/session/archive/change-log-YYYY-MM.md`.

Strict option:

- Set `strictTasksDoc: true` in `docs/session/active-work-context.json` (or `SESSION_TASKS_STRICT=1`) to make `docs/session/tasks.md` required rather than warning-level.

## Meaningful Cycle Definition

A cycle is meaningful when it includes any of:

- behavior/code changes
- verification outcomes that change confidence/next steps
- decisions that change implementation direction
- commits/pushes that move branch state

## Definition Of Done

Done requires all of:

1. Targeted tests for changed behavior.
2. Full project verification (tests/type-check/build as applicable).
3. Session docs freshness.
4. Atomic commit.
