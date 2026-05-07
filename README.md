# Agent Session Kit

## ASK 4.0 Runtime Status

Current release line: `v4.0.1`

Agent Session Kit (ASK) is a Developer-Agent Runtime for governing long-running implementation sessions before code reaches remote CI. It enforces session and policy checks at commit/push boundaries and keeps runtime state reconstructable through an event ledger.

ASK is implemented in `ask-core/` and integrated through git hooks and session adapter wrappers.

## What Changed in 4.0 (from 3.0)

ASK 3.0 was primarily a session governance toolkit packaged with installer and helper utilities around the runtime.  
ASK 4.0 is becoming a runtime-first execution layer: `ask-core` is the product center, hook-enforced policy gates are the stable contract, and orchestration intelligence lives in governed CLI/runtime flows.
The `ask codex` command family is a core part of this shift, moving Codex execution from ad-hoc usage to policy-governed launch, direct-exception control, and context-budget management.

For developers, this means less tooling sprawl, clearer enforcement boundaries, and a more explicit operating model for long-running AI-assisted delivery.

## What ASK Is

ASK is a runtime discipline layer for AI-assisted software delivery. It gives teams:

- deterministic session and task lifecycle signals
- policy-aware preflight and commit readiness checks
- commit/push guard enforcement through hooks
- replayable runtime history via `.ask/runtime/events.ndjson`
- projection snapshots for operational visibility

In practical terms, ASK reduces avoidable integration mistakes by enforcing the same checks locally that teams usually discover too late in CI.

## Why Teams Use It

Without explicit runtime governance, agent sessions drift: context mismatches, stale verification, and weak handoff continuity. ASK addresses this by coupling workflow commands with policy gates.

Developer outcomes:

- safer day-to-day commit/push behavior
- consistent policy behavior across contributors and machines
- faster resume/recovery for long-running sessions
- clearer evidence trail for merge readiness

## ASK 4 Architecture at a Glance

- `ask-core/`: runtime engine + CLI command surface
- `.ask/`: runtime state directory generated at execution time
- `.githooks/pre-commit` and `.githooks/pre-push`: enforcement entrypoints
- `scripts/session/runAskCorePreCommitAdapter.mjs` and `scripts/session/runAskCorePrePushAdapter.mjs`: wrapper adapters called by hooks
- `scripts/session/installHooks.mjs`: hook activation helper (`core.hooksPath=.githooks`)

## Prerequisites

- Node.js 20+
- Git

## Quick Start (Inside This Repository)

```bash
npm test
node ask-core/bin/ask.js --help
node ask-core/bin/ask.js preflight
node ask-core/bin/ask.js can-commit
```

Enable hooks:

```bash
npm run session:hooks:install
git config --get core.hooksPath
```

Expected output:

```text
.githooks
```

## Operations Docs

Operational runtime guidance lives in:

- `docs/operations/README.md`
- `docs/operations/runtime-architecture.md`
- `docs/operations/policy-reference.md`
- `docs/operations/operator-playbooks.md`

## Adopt ASK in Another Repository (Vendor Copy + Hooks)

ASK 4 currently uses a vendor-copy model. Copy these assets into your target repository:

- `ask-core/`
- `.githooks/`
- `scripts/session/installHooks.mjs`
- `scripts/session/runAskCorePreCommitAdapter.mjs`
- `scripts/session/runAskCorePrePushAdapter.mjs`

Then in the target repo:

```bash
node scripts/session/installHooks.mjs
node ask-core/bin/ask.js init
```

Optional validation:

```bash
node scripts/session/runAskCorePreCommitAdapter.mjs
node scripts/session/runAskCorePrePushAdapter.mjs
```

## Git Hook Enforcement Contract

ASK hook enforcement is intentionally explicit and stable:

- `.githooks/pre-commit` executes `node scripts/session/runAskCorePreCommitAdapter.mjs`
- `.githooks/pre-push` executes `node scripts/session/runAskCorePrePushAdapter.mjs`
- adapters execute `ask init`, `ask context verify`, then gate checks (`ask pre-commit-check` / `ask pre-push-check`)

A non-zero adapter exit blocks the git operation.

## CLI Command Catalog (Grouped)

Run all commands via:

```bash
node ask-core/bin/ask.js <command>
```

Session and context:

- `ask init [--reset-runtime]`
- `ask session start|pause|resume|block|status|close|doctor`
- `ask context verify|status`

Policy and commit readiness:

- `ask preflight`
- `ask can-commit`
- `ask pre-commit-check`
- `ask pre-push-check`

Task, workflow, and continuity:

- `ask task create|assign|start|complete|depends|status`
- `ask workflow recommend|start|artifact|complete|fail`
- `ask flow list|status|discover --last|validate --last|promote ...`
- `ask design list|status|discover --last|validate --last`
- `ask continue`, `ask project-state`, `ask resume-packet show`, `ask metrics show`

Coordination and routing:

- `ask route recommend|status`
- `ask claim acquire|release|lock|status`
- `ask child-session spawn|status`
- `ask agent register|status|dispatch`

Delivery governance:

- `ask feature create|link-task|status`
- `ask release create|link-feature|status`
- `ask promote require|pass|advance|status`
- `ask rollout start|phase|status`
- `ask rollback trigger`

Codex-specific controls:

- `ask codex [launch] ...`
- `ask codex direct --reason <text> ...`
- `ask codex context status|ensure|compact`

## Recommended Developer Flow

1. `ask init`
2. `ask session start`
3. `ask context verify`
4. Implement work and track runtime artifacts
5. `ask preflight` and `ask can-commit`
6. Commit and push with hooks enforcing final gates

## Runtime State and Source Control

- ASK runtime state is generated under `.ask/`.
- Volatile runtime logs and snapshots should remain excluded from version control.
- Keep static policy/configuration files as needed by your team.

## v3 to v4 Migration Notes

v4 keeps core runtime governance and hook enforcement, but repository packaging changed.
The change above is intentional: v4 shifts from “tool bundle + helpers” toward “runtime core + enforcement contract,” and the migration steps below reflect that operating model.

Key changes from v3:

- Removed bundled installer path (`install-session-kit.mjs`)
- Removed legacy `kit/` helper surface (`resumeSession`, `nextTask`, archive helpers, lock helpers)
- Removed v3 release-doc and autonomy wrapper surfaces from this repo
- Retained and strengthened `ask-core` runtime + hook adapter enforcement

Migration checklist for v3 users:

1. Stop relying on `install-session-kit.mjs` and `kit/` scripts.
2. Vendor-copy the v4 assets listed in "Adopt ASK in Another Repository".
3. Run `node scripts/session/installHooks.mjs` in each target repo.
4. Validate `core.hooksPath` is `.githooks`.
5. Verify your team workflow against `ask preflight`, `ask can-commit`, and hook gate behavior.

## Local Development

```bash
npm test
npm run ask
npm run ask:preflight
npm run ask:can-commit
npm run ask:pre-commit-check
npm run ask:pre-push-check
```

## Open Source Files

- `LICENSE` (MIT)
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
