# Team SOP: Agent Session Kit

Copy this into your target repository (for example: `docs/process/agent-session-sop.md`) and adjust placeholders.

---

## Purpose

This SOP defines how we use Agent Session Kit (ASK) to keep AI-assisted development workflows deterministic, auditable, and collaboration-safe.

## Scope

Applies to all contributors working in this repository, especially when AI agents are used for coding, refactoring, and debugging.

## Required Workflow

1. Work in the intended branch/worktree context.
2. Keep session docs fresh for each meaningful work cycle.
3. Pass ASK guard checks before commit and push.

## Session Documents (Required)

- `docs/session/current-status.md`
- `docs/session/change-log.md`
- `docs/session/tasks.md` (Now/Next/Done board)
- `docs/session/open-loops.md` (required when decisions/risks/scope change)

## Meaningful Work Cycle Definition

A cycle is meaningful when one or more of the following occur:

- behavior/code changes
- verification outcomes that change confidence or next steps
- decisions that change implementation direction
- commits/pushes that move branch state

## Daily Operating Rules

For each meaningful cycle:

1. Update `current-status.md` with active objective, latest verification, and next tasks.
2. Update `change-log.md` with:
   - files changed
   - behavior change summary
   - exact verification commands and outcomes
3. Update `tasks.md` so `Now`, `Next`, and `Done` match current execution state.
4. Update `open-loops.md` if unresolved decisions/risks changed.

## Verification Standard

Before claiming completion:

1. Run relevant tests/checks.
2. Confirm successful output.
3. Record verification commands in `change-log.md`.

No completion claims without fresh verification evidence.

## Fast-Check First

Use a fast-check lane before full CI:

- Fast-check command:
  - `npm run fast-check`
- Route examples:
  - UI changes -> `npm run test -- src/test/ui`
  - domain changes -> `npm run test -- src/test/domain`
  - runtime/infrastructure changes -> `npm run test -- src/test/runtime`
- Pre-merge full gate:
  - `npm run test:ci` (or your repo equivalent)

## Hook Enforcement

The repo enforces:

- `pre-commit`:
  - work context validator
  - session freshness validator
- `pre-push`:
  - work context validator
  - session freshness validator

If a hook fails, fix the root cause rather than bypassing by default.

## Emergency Bypass Policy

Bypass is allowed only for controlled recovery:

- `SESSION_CONTEXT_BYPASS=1`
- `SESSION_DOCS_BYPASS=1`

Optional strict tasks mode:

- Default policy is soft mode (`strictTasksDoc: false`) unless your team explicitly elevates to strict.
- `SESSION_TASKS_STRICT=1` (temporary/session)
- or `strictTasksDoc: true` in `docs/session/active-work-context.json` (repo policy)

If bypass is used, you must log:

- reason
- scope
- follow-up remediation task

in `docs/session/change-log.md`.

## Branch/Worktree Lock File

`docs/session/active-work-context.json` defines expected branch/path behavior.

Update this file only when intentionally changing active branch/worktree policy.

Optional repo-level lock (recommended for worktree-heavy repos):

- Set lock:
  - `node scripts/session/setRepoWorkContextLock.mjs --branch <branch-name> --repo-suffix <path-suffix> --enforce-path-suffix true`
- Clear lock:
  - `node scripts/session/clearRepoWorkContextLock.mjs`

When enabled, repo lock values (`session.workContextLock.*`) take precedence over file context.

## Ownership

- Process owner: `<team/role>`
- Escalation contact: `<maintainer/contact>`
- Review cadence: `<weekly/biweekly>`

## Rollout Checklist (Initial Setup)

- [ ] ASK installed into repository
- [ ] `core.hooksPath` set to `.githooks`
- [ ] preflight checks pass
- [ ] `active-work-context.json` configured for this repo
- [ ] branch protection enabled with required CI checks
- [ ] team onboarding completed
