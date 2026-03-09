# Agent Session Kit

## Why Agent Session Kit Exists

AI-assisted development has dramatically accelerated how quickly code can be written, explored, and refactored.

As iteration speed increases, workflow discipline often lags behind.

During internal development sessions, we repeatedly encountered problems such as:

- commits landing in the wrong branch
- session context documentation drifting out of date
- interrupted sessions resuming with stale assumptions
- inconsistent environments between machines
- skipped validation checks before pushing changes

These issues are not new, but AI-assisted development increases their frequency because sessions become longer, faster, and more exploratory.

Agent Session Kit (ASK) was created to address this gap.

ASK adds lightweight guardrails around standard Git workflows so workflow integrity keeps pace with coding speed.

Instead of relying on developer memory or discipline, ASK ensures key checks and validation steps happen automatically as part of the development process.

The result is a workflow that remains predictable, reproducible, and easier to collaborate on, even when AI agents are heavily involved in coding sessions.

Portable session-control package for any git repo.

It provides:

- session docs control plane (`docs/session/**`)
- branch/worktree guard validator
- session freshness validator
- pre-commit and pre-push hooks
- installer to copy and wire everything

## Why this exists

This keeps AI-agent work deterministic across long sessions and compaction:

- current state is always documented
- open decisions are tracked
- change history includes verification evidence
- hooks block commits/pushes when context is wrong or session docs are stale

## Prerequisites

- Node.js 20+
- Git

## Install

From this folder:

```powershell
node install-session-kit.mjs --target "C:\path\to\your-repo" --branch main
```

```bash
node install-session-kit.mjs --target /path/to/your-repo --branch main
```

Optional flags:

- `--force` overwrite existing kit files
- `--repo-suffix worktrees/feature-x` set expected repo path suffix in active context
- `--enforce-path-suffix true|false` (default `false`)
- `--dry-run` preview only

## What gets installed

- `.githooks/pre-commit`
- `.githooks/pre-push`
- `scripts/session/verifyWorkContext.mjs`
- `scripts/session/verifySessionDocsFreshness.mjs`
- `scripts/session/installHooks.mjs`
- `docs/session/AGENT_SESSION_LAWS.md`
- `docs/session/guardrails.md`
- `docs/session/active-work-context.json`
- `docs/session/current-status.md`
- `docs/session/tasks.md`
- `docs/session/open-loops.md`
- `docs/session/change-log.md`

## Post-install in target repo

```powershell
node scripts/session/installHooks.mjs
node scripts/session/verifyWorkContext.mjs --mode=preflight
node scripts/session/verifySessionDocsFreshness.mjs --mode=preflight
```

```bash
node scripts/session/installHooks.mjs
node scripts/session/verifyWorkContext.mjs --mode preflight
node scripts/session/verifySessionDocsFreshness.mjs --mode preflight
```

## Enforcement behavior

- `pre-commit`: blocks if active branch/worktree context fails or meaningful staged changes do not include required session docs.
- `pre-push`: blocks if outgoing commit range fails context or session freshness checks.

Required session docs for meaningful changes:

- `docs/session/current-status.md`
- `docs/session/change-log.md`

Warning-level session docs for meaningful changes:

- `docs/session/tasks.md` (recommended to reflect Now/Next/Done)
- `docs/session/open-loops.md` (recommended when decisions/risks change)

## Emergency Bypass

- `SESSION_CONTEXT_BYPASS=1`
- `SESSION_DOCS_BYPASS=1`

Use only for controlled recovery flows; bypass is intended to be explicit and auditable.

## Local Development

From `agent-session-kit/`:

```bash
npm run test
```

This runs the smoke test that installs the kit in a temp repo and validates:

- work-context guard pass/fail behavior
- session freshness guard pass/fail behavior
- installer wiring and hook setup path

## Open Source Files

- `LICENSE` (MIT)
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

## Documentation

- `docs/README.md` - doc index and reading order
- `docs/how-it-works.md` - architecture and flow overview
- `docs/adoption-guide.md` - rollout guidance for teams
- `docs/team-sop-template.md` - copy-paste SOP template for target repositories
