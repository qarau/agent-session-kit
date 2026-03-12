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

## Task Flow Reminder (Soft)

Use these helpers for a smoother agent/developer loop:

```bash
node scripts/session/nextTask.mjs
node scripts/session/completeTask.mjs
```

`completeTask.mjs` marks the current `Now` task done, promotes the next task when needed, and prints the next recommendation.

ASK also installs a soft `post-commit` reminder that runs `nextTask.mjs` automatically (non-blocking).

## Session Log Archiving

Use this to keep active `docs/session/change-log.md` compact while preserving history:

```bash
node scripts/session/archiveSessionLog.mjs --keep-sections 14
```

This keeps the most recent sections in `change-log.md` and moves older dated sections to:

- `docs/session/archive/change-log-YYYY-MM.md`

## Optional Repo-Level Context Lock

Use this when working with multiple branches/worktrees to prevent commits on the wrong branch after context drift.

```bash
node scripts/session/setRepoWorkContextLock.mjs --branch <branch-name> --repo-suffix <path-suffix> --enforce-path-suffix true
```

Clear lock:

```bash
node scripts/session/clearRepoWorkContextLock.mjs
```

`ask context verify` automatically prefers repo lock values when lock is enabled.

## Optional Repo Boundary Guards

Use this when your architecture depends on specific repo boundaries (for example, split repos or extracted toolkits) and you want CI to detect boundary regressions early.

Add a runtime/architecture test in your target repo that fails when forbidden paths appear.

Example (Vitest):

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('repo boundaries', () => {
  it('fails if forbidden embedded path exists', () => {
    const appRoot = process.cwd();
    const forbiddenPath = path.resolve(appRoot, 'agent-session-kit');
    expect(fs.existsSync(forbiddenPath)).toBe(false);
  });
});
```

Recommended policy:

- Keep this test in your standard CI lane (for example `test:runtime` or `test:architecture`).
- Use it for high-risk boundaries (embedded repos, generated directories, or forbidden coupling points).
- Record boundary policy decisions in `docs/session/open-loops.md`.

### Migration Quick Commands

```bash
# 1) clear any previous lock (safe to run repeatedly)
node scripts/session/clearRepoWorkContextLock.mjs

# 2) set lock for your current worktree branch
node scripts/session/setRepoWorkContextLock.mjs --branch <branch-name> --repo-suffix <worktree-path-suffix> --enforce-path-suffix true

# 3) verify lock is active
node ask-core/bin/ask.js context verify

# 4) when intentionally changing branch/worktree policy
node scripts/session/clearRepoWorkContextLock.mjs
node scripts/session/setRepoWorkContextLock.mjs --branch <new-branch> --repo-suffix <new-worktree-path-suffix> --enforce-path-suffix true
```

## Enforcement behavior

- `main/release*` uses fail-closed guardrails for session and release governance checks.
- Feature branches run advisory mode so drift is visible without blocking iteration.
- `pre-commit`: ask-core-only (`ask pre-commit-check`) and blocks if active branch/worktree context fails or meaningful staged changes do not include required session docs.
- `pre-push`: ask-core-only (`ask pre-push-check`) and blocks if outgoing commit range fails context, docs freshness, release-doc consistency, or lifecycle policy checks.

Required session docs for meaningful changes:

- `docs/session/current-status.md`
- `docs/session/change-log.md`

Warning-level session docs for meaningful changes:

- `docs/session/tasks.md` (recommended to reflect Now/Next/Done)
- `docs/session/open-loops.md` (recommended when decisions/risks change)

Optional strict mode for tasks:

- Default policy: `strictTasksDoc` stays `false` (soft enforcement).
- Set `strictTasksDoc: true` in `docs/session/active-work-context.json`, or
- Set `SESSION_TASKS_STRICT=1` for command/session-level strict enforcement.

When strict mode is enabled, `docs/session/tasks.md` becomes required for meaningful changes.

Maintainer-only local runtime notes:

- `docs/ASK_Runtime/*` is local-only and must not be committed.
- Use `docs/session/*` and `docs/releases/*` for team-visible governance state.

## Emergency Bypass

- `SESSION_CONTEXT_BYPASS=1`
- `SESSION_DOCS_BYPASS=1`

Use only for controlled recovery flows; bypass is intended to be explicit and auditable.

## Runtime Stall Recovery

ASK adapter wrappers apply guarded runtime execution for each ask-core command step:

- Wall timeout default: `180s`
- No-output timeout default: `180s`
- Automatic retries on stall: `1`
- Operation state file: `.ask/runtime/last-operation.json`

Runtime diagnostics command:

```bash
node ask-core/bin/ask.js session doctor
```

Optional timeout overrides (advanced use):

- `ASK_STALL_WALL_TIMEOUT_MS`
- `ASK_STALL_NO_OUTPUT_TIMEOUT_MS`

## Optional Codex Context Budget

When enabled in runtime policy, ASK can track and manage Codex Responses API context budgets:

- `ask codex context status`
- `ask codex context ensure`
- `ask codex context compact`

Policy keys in `.ask/policy/runtime-policy.yaml`:

```yaml
codex_context:
  enabled: false
  min_remaining_ratio: 0.10
  reserve_output_tokens: 12000
  max_context_tokens: 400000
  strategy: explicit
```

Notes:

- Default is disabled (no behavior change for non-Codex users).
- API/network issues are advisory for `status`/`ensure` commands.
- `session doctor` includes codex summary when `.ask/runtime/context-session.json` exists.

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
