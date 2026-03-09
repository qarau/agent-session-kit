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

## Session Docs Freshness (Always-On)

For every meaningful cycle, update:

1. `docs/session/current-status.md`
2. `docs/session/change-log.md`
3. `docs/session/open-loops.md` when decisions/risks/scope changed

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
