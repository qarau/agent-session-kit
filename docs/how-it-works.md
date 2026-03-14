# How Agent Session Kit Works

This document explains the runtime flow in simple terms.
For maintainer-specific governance and protected-branch release discipline, see `maintainer-mode.md`.

## Core Idea

The kit enforces three things:

1. You are working in the intended branch/worktree.
2. Session docs are updated when meaningful code changes happen.
3. These checks run automatically before commit and push.
4. Optional repo-level lock can override file context to prevent branch drift.
5. Optional repo-boundary tests can enforce architecture boundaries in CI.

ASK 3.0 extends this into a Session OS runtime: event-ledger append, replay projections, and deterministic command contracts beyond commit/push gates.

The runtime lives in `ask-core/` so policy contracts and session behavior can be tested independently from hook wrapper scripts.
Session lifecycle depth is persisted with snapshot + journal files under `.ask/sessions/active-session.json`, `.ask/sessions/history.ndjson`, and `.ask/sessions/pending-transition.json`.
Lifecycle-aware `preflight` and `can-commit` checks use policy keys `allowed_preflight_states` and `allowed_can_commit_states` (default `active,paused`) to reject disallowed states (`blocked`, `closed`, `created`).
Pre-commit is ask-core-only (`ask pre-commit-check`) and pre-push is ask-core-only (`ask pre-push-check`).
Branch enforcement is configurable via `docs/session/active-work-context.json`:
- `branchEnforcementMode: "protected"` (default) enforces on `main` and `release/*`.
- `branchEnforcementMode: "all"` enforces on every branch.
- `branchEnforcementMode: "advisory"` keeps checks warning-level on every branch.

Pre-push release-doc checks are governance-mode aware:
- `governanceMode: "project"` (default) skips release-doc consistency checks.
- `governanceMode: "maintainer"` includes release-doc consistency checks and applies branch enforcement using `branchEnforcementMode`.
Adapter command execution uses guarded runtime behavior: `180s` wall/no-output timeout with one automatic retry on detected stall before failing.
Delivery governance command families are now first-class runtime contracts:
- `ask feature create|link-task|status`
- `ask release create|link-feature|status`
- `ask promote require|pass|advance|status`
- `ask rollout start|phase|status`
- `ask rollback trigger`

## Flow Overview

```mermaid
flowchart TD
    A[Run installer] --> B[Copy kit files into target repo]
    B --> C[Configure core.hooksPath to .githooks]
    C --> D[Developer runs git commit]
    D --> E[pre-commit hook]
    E --> F[runAskCorePreCommitAdapter]
    F --> G{Pass?}
    G -- No --> H[Commit blocked with clear error]
    G -- Yes --> I[Commit allowed]
    I --> J[Developer runs git push]
    J --> K[pre-push hook]
    K --> L[runAskCorePrePushAdapter]
    L --> M{Pass?}
    M -- No --> N[Push blocked with clear error]
    M -- Yes --> O[Push allowed]
```

## Components

- Installer: `install-session-kit.mjs`
- Hook setup helper: `scripts/session/installHooks.mjs`
- Resume helper: `scripts/session/resumeSession.mjs`
- Change-log archiver: `scripts/session/archiveSessionLog.mjs`
- Task reminder helpers:
  - `scripts/session/nextTask.mjs`
  - `scripts/session/completeTask.mjs`
- Repo lock helpers:
  - `scripts/session/setRepoWorkContextLock.mjs`
  - `scripts/session/clearRepoWorkContextLock.mjs`
- Ask-core adapter wrappers:
  - `scripts/session/runAskCorePreCommitAdapter.mjs`
  - `scripts/session/runAskCorePrePushAdapter.mjs`
- Runtime operation state: `.ask/runtime/last-operation.json`
- Hook templates: `.githooks/pre-commit`, `.githooks/pre-push`
- Hook template: `.githooks/post-commit` (soft next-task reminder)
- Session templates: `docs/session/*`
- Standalone runtime package: `ask-core/*` (core session runtime, policy, and governance checks)

## Optional Repo-Level Lock

Set lock:

```bash
node scripts/session/setRepoWorkContextLock.mjs --branch <branch-name> --repo-suffix <path-suffix> --enforce-path-suffix true
```

Clear lock:

```bash
node scripts/session/clearRepoWorkContextLock.mjs
```

When enabled, `ask context verify` uses `git config` lock values (`session.workContextLock.*`) instead of `active-work-context.json`.

## Optional Repo Boundary Guards

Use this for architecture rules that are outside hook scope.

Pattern:

1. Define forbidden paths (or other boundary invariants).
2. Add deterministic tests that fail when violated.
3. Keep those tests in regular CI (`test:runtime` or `test:architecture`).

See `repo-boundary-guards.md` for reusable templates.

## Resume Snapshot

Use this to quickly rehydrate session context after interruptions:

```bash
node scripts/session/resumeSession.mjs
```

The output includes current branch, HEAD, active objective, next unchecked task, and latest verification command.

## Stall Recovery Diagnostics

If adapter execution appears stuck:

```bash
node ask-core/bin/ask.js session doctor
```

Doctor reads `.ask/runtime/last-operation.json` and reports latest runtime status, retry attempt metadata, and deterministic recovery guidance.

## Optional Codex Context Budget Flow

For Codex Responses API workflows, ASK can run context budget checks and proactive compaction at safe checkpoints:

```bash
node ask-core/bin/ask.js codex context status
node ask-core/bin/ask.js codex context ensure
```

Runtime state is persisted to `.ask/runtime/context-session.json` and summarized by `ask session doctor`.

## Task Reminder Loop

Recommended flow:

```bash
node scripts/session/completeTask.mjs
```

This updates `tasks.md` and prints the next recommendation. A soft `post-commit` hook also prints the next task after each commit.

## Session Documentation Policy

Canonical session documentation rules live in `docs/session/guardrails.md`:

- meaningful cycle definition
- required and warning-level session docs
- strict tasks mode (`strictTasksDoc` / `SESSION_TASKS_STRICT`)
- expected task helper usage

## Bypass Behavior

Emergency bypass exists for controlled recovery:

- `SESSION_CONTEXT_BYPASS=1`
- `SESSION_DOCS_BYPASS=1`

Use bypass only when unavoidable and document why in `change-log.md`. Governance expectations are defined in `docs/session/guardrails.md`.
