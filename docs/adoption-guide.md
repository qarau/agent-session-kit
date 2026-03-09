# Adoption Guide

This guide explains the standard way teams adopt Agent Session Kit in open-source and enterprise repositories.

## Typical Open-Source Pattern

Most OSS projects do this:

1. Keep `README.md` short and action-focused.
2. Put detailed explanations in `docs/`.
3. Add CI checks that enforce the expected workflow.
4. Use branch protection so required checks cannot be bypassed in normal flow.

Agent Session Kit follows this model.

## Recommended Rollout Steps

1. Install kit in the repository:
   - `node install-session-kit.mjs --target /path/to/repo --branch main`
2. Run setup and preflight checks:
   - `node scripts/session/installHooks.mjs`
   - `node scripts/session/verifyWorkContext.mjs --mode preflight`
   - `node scripts/session/verifySessionDocsFreshness.mjs --mode preflight`
3. Commit the installed files.
4. Enable branch protection on `main`.
5. Require CI status checks before merge.

## Team Conventions

- Update `docs/session/current-status.md` every meaningful cycle.
- Update `docs/session/change-log.md` with exact verification commands run.
- Keep `docs/session/tasks.md` current so `Now`, `Next`, and `Done` are visible at a glance.
- Update `docs/session/open-loops.md` when decisions or risk status changes.
- Keep bypass usage explicit and rare.

## Suggested Branch Protection

- Require pull request before merging.
- Require status checks to pass before merging.
- Include administrators.
- Prevent force pushes to protected branch.

## Maintenance Checklist

When changing script behavior:

1. Update smoke tests.
2. Update docs in `README.md` and `docs/`.
3. Run `npm run test`.
4. Verify CI still passes.
