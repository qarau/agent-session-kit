# Agent Session Kit

## ASK 2.0 Status

Current release: `v2.0.0` (2026-03-12)

- [Release notes](docs/releases/v2.0.0.md)
- [Announcement copy](docs/releases/v2.0.0-announcement.md)
- [Latest release pointer](docs/releases/latest.md)

ASK 2.0 is a major architectural shift from script-first checks to a standalone runtime core.

## What ASK Is

Agent Session Kit (ASK) is a Developer-Agent Runtime that governs developer-agent work in progress.

The runtime is implemented in `ask-core/` and this repository packages installer, adapters, hooks, and governance docs for rollout into target repositories.

## Why ASK 2.0 Exists

ASK 2.0 exists because AI-assisted development made script-first guardrails too fragile at team scale.

Before 2.0, teams repeatedly hit the same failure pattern:

- branch/worktree mistakes discovered too late
- session docs drift during long-running agent work
- split logic across wrappers and scripts causing policy drift
- stalled agent runs without reliable recovery behavior
- context-loss interruptions that slowed resume and handoff

ASK 2.0 addresses this by moving governance into one runtime core (`ask-core`) with a single enforcement path for commit/push checks.

The practical buy-in for developers:

- fewer avoidable workflow mistakes before CI
- consistent policy behavior across machines and agents
- faster, cleaner resume and handoff in long sessions
- less time debugging guardrail inconsistencies

ASK 2.0 provides:

- session docs control plane (`docs/session/**`)
- branch/worktree guard validator
- session freshness validator
- pre-commit and pre-push hooks
- lifecycle-policy aware runtime commands (`ask preflight`, `ask can-commit`)
- runtime-only commit/push gates (`ask pre-commit-check`, `ask pre-push-check`)
- guarded adapter execution (`180s` stall timeout, one automatic retry)
- optional Codex context-budget commands for long-session resilience

## ASK CLI Quick Reference

Run the CLI directly from this repository:

```bash
node ask-core/bin/ask.js <command>
```

Core command groups:

- Session lifecycle:
  - `ask session start|pause|resume|block|status|close|doctor`
  - Use this to track active work state, enforce lifecycle policy, and inspect runtime health.
- Work context:
  - `ask context verify|status`
  - Use this to validate branch/worktree/repo context before commit/push.
- Policy checks:
  - `ask preflight`
  - `ask can-commit`
  - Use this to evaluate readiness and policy requirements for current session state.
- Git gate contracts:
  - `ask pre-commit-check`
  - `ask pre-push-check`
  - These are the runtime commands wired into hook adapters.
- Codex context budget (optional):
  - `ask codex context status|ensure|compact`
  - Use this when Codex Responses API workflows need context-budget monitoring/compaction.

Common examples:

```bash
node ask-core/bin/ask.js session start
node ask-core/bin/ask.js context verify
node ask-core/bin/ask.js pre-commit-check
node ask-core/bin/ask.js session doctor
```

## Prerequisites

- Node.js 20+
- Git

## Compatibility

- Developed and tested in Codex 5.3 CLI.
- Works well with [Superpowers](https://github.com/obra/superpowers) for skill-driven agent workflows.
- ASK is workflow-level and agent-agnostic; it can improve GUI-agent workflows (for example Codex and Claude) when those workflows use the same git/hooks/session-doc guardrails.

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
- `.githooks/post-commit`
- `ask-core/**`
- `scripts/session/runAskCorePreCommitAdapter.mjs`
- `scripts/session/runAskCorePrePushAdapter.mjs`
- `scripts/session/installHooks.mjs`
- `scripts/session/setRepoWorkContextLock.mjs`
- `scripts/session/clearRepoWorkContextLock.mjs`
- `scripts/session/resumeSession.mjs`
- `scripts/session/archiveSessionLog.mjs`
- `scripts/session/nextTask.mjs`
- `scripts/session/completeTask.mjs`
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
node scripts/session/runAskCorePreCommitAdapter.mjs
node scripts/session/runAskCorePrePushAdapter.mjs
node scripts/session/resumeSession.mjs
node scripts/session/nextTask.mjs
node scripts/session/archiveSessionLog.mjs --keep-sections 14
```

```bash
node scripts/session/installHooks.mjs
node scripts/session/runAskCorePreCommitAdapter.mjs
node scripts/session/runAskCorePrePushAdapter.mjs
node scripts/session/resumeSession.mjs
node scripts/session/nextTask.mjs
node scripts/session/archiveSessionLog.mjs --keep-sections 14
```

## Project Onboarding Checklist

### 1) One-Time Repo Setup (Owner)

- [ ] Install ASK into the repo:

```bash
node /path/to/agent-session-kit/install-session-kit.mjs --target . --branch main
```

- [ ] Install git hooks:

```bash
node scripts/session/installHooks.mjs
```

- [ ] Create initial session baseline:

```bash
node scripts/session/resumeSession.mjs
```

- [ ] Commit installed ASK files (`.githooks/*`, `scripts/session/*`, `docs/session/*`).

### 2) Team Setup (Each Developer)

- [ ] Pull latest repo changes.
- [ ] Confirm hooks are active (`.githooks/pre-commit`, `.githooks/pre-push`).
- [ ] Run:

```bash
node scripts/session/resumeSession.mjs
```

### 3) Daily Workflow

- [ ] Start by updating `docs/session/current-status.md`.
- [ ] Track active work in `docs/session/tasks.md`.
- [ ] Update `docs/session/open-loops.md` when decisions or risks change.
- [ ] Append verification evidence to `docs/session/change-log.md`.
- [ ] Commit and push normally (hooks enforce context/freshness checks).

### 4) Required Session Docs For Meaningful Code Changes

- [ ] `docs/session/current-status.md`
- [ ] `docs/session/change-log.md`

### 5) Optional Guardrails

- [ ] Enable repo lock for multi-worktree safety:

```bash
node scripts/session/setRepoWorkContextLock.mjs --branch <branch> --repo-suffix <path-suffix> --enforce-path-suffix true
```

- [ ] Clear lock when changing branch/worktree policy:

```bash
node scripts/session/clearRepoWorkContextLock.mjs
```

### 6) Recovery / Emergency

- [ ] Use bypass only for controlled recovery (`SESSION_CONTEXT_BYPASS=1`, `SESSION_DOCS_BYPASS=1`).
- [ ] If bypass is used, document why in `docs/session/change-log.md`.

### 7) Runtime Status (2026-03-12)

- [ ] `pre-commit` is ask-core-only (`ask pre-commit-check`).
- [ ] `pre-push` is ask-core-only (`ask pre-push-check`).
- [ ] Adapter command execution has stall recovery (`180s` wall/no-output timeout + one retry).

## Operational Details

Use the focused docs below instead of repeating operational policy in this README:

- [docs/how-it-works.md](docs/how-it-works.md) - runtime flow, enforcement behavior, strict mode, bypass, and diagnostics
- [docs/adoption-guide.md](docs/adoption-guide.md) - rollout sequence, branch policy, team conventions, and branch protection
- [docs/repo-boundary-guards.md](docs/repo-boundary-guards.md) - CI architecture boundary guard patterns
- [docs/session/guardrails.md](docs/session/guardrails.md) - maintainer guardrails and session documentation discipline
- [docs/maintainer-mode.md](docs/maintainer-mode.md) - maintainer-only governance and protected-branch verification flow

## Local Development

From `agent-session-kit/`:

```bash
npm run test
npm run test:release-docs
```

This runs the smoke test that installs the kit in a temp repo and validates:

- work-context guard pass/fail behavior
- repo-level work-context lock pass/fail behavior
- session freshness guard pass/fail behavior
- installer wiring and hook setup path
- release-doc mapping guard behavior (released vs draft + latest pointer checks)

## Open Source Files

- `LICENSE` (MIT)
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

## Documentation

- [docs/README.md](docs/README.md) - doc index and reading order
- [docs/how-it-works.md](docs/how-it-works.md) - architecture and flow overview
- [docs/adoption-guide.md](docs/adoption-guide.md) - rollout guidance for teams
- [docs/repo-boundary-guards.md](docs/repo-boundary-guards.md) - reusable repo-boundary guard patterns
- [docs/team-sop-template.md](docs/team-sop-template.md) - copy-paste SOP template for target repositories
- [docs/maintainer-mode.md](docs/maintainer-mode.md) - branch-aware maintainer policy and verification flow
- [docs/releases/README.md](docs/releases/README.md) - release ledger and version mapping
- [docs/releases/release-checklist.md](docs/releases/release-checklist.md) - release publishing checklist
- [docs/releases/latest.md](docs/releases/latest.md) - latest released version pointers
- [docs/releases/v2.0.0.md](docs/releases/v2.0.0.md) - ASK 2.0 release notes
- [docs/releases/v2.0.0-announcement.md](docs/releases/v2.0.0-announcement.md) - ASK 2.0 announcement copy
