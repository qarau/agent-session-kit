# Agent Session Kit

## ASK 3.0 Runtime Status

Current stable release: `v2.0.0` (2026-03-12)  
Current development direction: `ASK 3.0 Session OS` (event-ledger runtime expansion)

- [Release notes](docs/releases/v2.0.0.md)
- [Announcement copy](docs/releases/v2.0.0-announcement.md)
- [Latest release pointer](docs/releases/latest.md)

ASK 2.0 established the standalone runtime core. ASK 3.0 expands that core into a full event-ledger runtime for planning, execution, routing, and delivery governance.

## What ASK Is

Agent Session Kit (ASK) is a Developer-Agent Runtime that governs developer-agent work in progress.

The runtime is implemented in `ask-core/` and this repository packages installer, adapters, hooks, and governance docs for rollout into target repositories.

## Why ASK 3.0 Exists

ASK 3.0 exists because commit/push gates alone are not enough for long-running developer-agent execution.

Teams need runtime discipline across the full session lifecycle:

- event-first state reconstruction (`ask replay`)
- deterministic session/task/workflow/evidence traces
- freshness and integration readiness before merge
- routing/claims/child-session coordination for multi-agent execution
- promotion/rollout/rollback governance with explicit invariants

ASK 3.0 keeps ASK 2.0 branch/doc gates and adds a broader Session OS runtime model on top of the same `ask-core` foundation.

The practical buy-in for developers:

- fewer avoidable workflow mistakes before CI
- consistent policy behavior across machines and agents
- faster, cleaner resume and handoff in long sessions
- less time debugging guardrail inconsistencies

ASK 3.0 provides:

- event-ledger + projection snapshots (`.ask/runtime/events.ndjson`, `.ask/runtime/snapshots/*`)
- session docs control plane (`docs/session/**`)
- branch/worktree guard validator + lifecycle gating
- session freshness and dependency-aware verification state
- integration and merge-readiness runtime slices
- routing/claims/child-session multi-agent coordination
- delivery governance runtime (`feature`, `release`, `promote`, `rollout`, `rollback`)
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
- Task/workflow and agent coordination:
  - `ask task create|assign|start|depends|status`
  - `ask workflow recommend|start|artifact|complete|fail`
  - `ask route recommend|status`, `ask claim acquire|release|lock|status`, `ask child-session spawn|status`, `ask agent register|status`
- Delivery governance:
  - `ask feature create|link-task|status`
  - `ask release create|link-feature|status`
  - `ask promote require|pass|advance|status`
  - `ask rollout start|phase|status`
  - `ask rollback trigger`
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
- ASK Runtime is platform-agnostic at the workflow layer; it can improve CLI and GUI agent workflows (for example Codex and Claude) when those workflows use the same git/hooks/session-doc guardrails.

## Ideal Pairing: Superpowers + ASK Runtime

This is the recommended operating model for AI-assisted development:

- Superpowers: development workflow (how work gets designed and executed)
- Codex 5.3: implementation worker (fast execution in the loop)
- ASK Runtime: session discipline (how work stays governed and shippable)

Together, Superpowers + Codex 5.3 + ASK Runtime provide a high-leverage workflow: plan with rigor, execute quickly, and stay policy-safe from first edit to push.

Responsibility split:

- Superpowers drives process quality through skills (for example: brainstorming, writing plans, executing plans, code review).
- Codex 5.3 executes implementation tasks rapidly inside that process.
- ASK Runtime enforces session and git discipline (context checks, freshness checks, lifecycle gates, pre-commit/pre-push policy).

Why the pairing works:

- You get better decisions before coding (Superpowers).
- You get safer execution during coding (ASK Runtime).
- You get consistent merge readiness at commit/push time (ASK Runtime hooks and runtime checks).

Typical combined flow:

1. Use Superpowers skills to design and plan the change.
2. Use ASK commands (`ask session start`, `ask context verify`, `ask preflight`) to establish runtime safety.
3. Implement with Superpowers-guided execution while keeping `docs/session/*` current.
4. Let ASK pre-commit/pre-push checks enforce repository policy before integration.

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
- [docs/ask-3.0-architecture.md](docs/ask-3.0-architecture.md) - ASK 3.0 Session OS architecture, bridge mode, and cutover mode
- [docs/adoption-guide.md](docs/adoption-guide.md) - rollout sequence, branch policy, team conventions, and branch protection
- [docs/repo-boundary-guards.md](docs/repo-boundary-guards.md) - CI architecture boundary guard patterns
- [docs/session/guardrails.md](docs/session/guardrails.md) - maintainer guardrails and session documentation discipline
- [docs/maintainer-mode.md](docs/maintainer-mode.md) - maintainer-only governance and protected-branch verification flow
- [docs/autonomy-mode.md](docs/autonomy-mode.md) - phase-based autonomous verification workflow for Codex execution

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
- [docs/ask-3.0-architecture.md](docs/ask-3.0-architecture.md) - ASK 3.0 runtime layers and migration path
- [docs/adoption-guide.md](docs/adoption-guide.md) - rollout guidance for teams
- [docs/repo-boundary-guards.md](docs/repo-boundary-guards.md) - reusable repo-boundary guard patterns
- [docs/team-sop-template.md](docs/team-sop-template.md) - copy-paste SOP template for target repositories
- [docs/maintainer-mode.md](docs/maintainer-mode.md) - branch-aware maintainer policy and verification flow
- [docs/releases/README.md](docs/releases/README.md) - release ledger and version mapping
- [docs/releases/release-checklist.md](docs/releases/release-checklist.md) - release publishing checklist
- [docs/releases/latest.md](docs/releases/latest.md) - latest released version pointers
- [docs/releases/v2.0.0.md](docs/releases/v2.0.0.md) - ASK 2.0 release notes
- [docs/releases/v2.0.0-announcement.md](docs/releases/v2.0.0-announcement.md) - ASK 2.0 announcement copy
