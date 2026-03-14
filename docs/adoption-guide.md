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
   - `node scripts/session/runAskCorePreCommitAdapter.mjs`
   - `node scripts/session/runAskCorePrePushAdapter.mjs`
   - `node scripts/session/nextTask.mjs`
3. Optional (recommended for worktrees): set repo-level lock:
   - `node scripts/session/setRepoWorkContextLock.mjs --branch <branch-name> --repo-suffix <path-suffix> --enforce-path-suffix true`
4. Commit the installed files.
5. Enable branch protection on `main`.
6. Require CI status checks before merge.
7. Optional (recommended for split-repo migrations): add repo-boundary tests to prevent forbidden path regressions.

## Branch-Aware Enforcement

- Configure `branchEnforcementMode` in `docs/session/active-work-context.json`:
  - `"protected"` (default): fail-closed on `main` and `release/*`, advisory on feature branches.
  - `"all"`: fail-closed on every branch.
  - `"advisory"`: advisory on every branch.
- For most downstream repos, keep `governanceMode: "project"` in `docs/session/active-work-context.json` so release-doc checks are not required.
- Use `governanceMode: "maintainer"` only for repos that publish and enforce ASK release docs.

## Team Conventions

- Update `docs/session/current-status.md` every meaningful cycle.
- Update `docs/session/change-log.md` with exact verification commands run.
- Keep `docs/session/tasks.md` current so `Now`, `Next`, and `Done` are visible at a glance.
- Update `docs/session/open-loops.md` when decisions or risk status changes.
- Keep bypass usage explicit and rare.
- Keep `docs/ASK_Runtime/*` local-only; do not commit runtime scratch data.

## ASK 3.0 Migration Modes

Use explicit migration mode language when rolling out ASK 3.0 features:

- Bridge mode:
  - Keep legacy session docs and hook behavior active.
  - Add event-ledger and replay snapshots in parallel.
  - Treat snapshot parity gaps as blockers for cutover.
- Cutover mode:
  - Projection snapshots are authoritative for runtime state.
  - Keep session docs as operator-facing evidence, not the source of runtime truth.
  - Remove legacy direct-state mutation paths after parity is stable.

Optional strict mode:

- Set `strictTasksDoc: true` in `docs/session/active-work-context.json` to require `docs/session/tasks.md` on meaningful changes.

Optional repo-level lock:

- Use `setRepoWorkContextLock.mjs` to bind a repo/worktree to one branch policy in git config.
- Use `clearRepoWorkContextLock.mjs` to remove the lock during intentional branch transitions.

Optional repo-boundary guards:

- Add tests for forbidden embedded paths and other architecture boundaries.
- Keep them in your normal CI path so regressions fail fast.
- Use `docs/repo-boundary-guards.md` templates to standardize this across repos.

For command-level operational detail (repo lock transitions, session log compaction, and next-task helper flow), use `docs/how-it-works.md`.

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
