# ASK Autonomy Mode (Codex Workflow)

This document defines the fastest safe workflow for autonomous ASK phase execution.

## Purpose

Avoid repetitive in-sandbox failure then out-of-sandbox retry loops during verification-heavy phases.

## Core Pattern

1. Run phase verification through one command:
   - `npm run ask:verify:phase1`
   - `npm run ask:verify:phase2`
   - `npm run ask:verify:phase3`
   - `npm run ask:verify:phase4`
   - `npm run ask:verify:phase5`
   - `npm run ask:verify:phase6`
2. Use escalated execution directly for verification commands in restricted environments.
3. Reserve interactive questions for:
   - requirement clarifications
   - scope changes
   - destructive or out-of-scope actions

## Autonomous Ship Gate

When verification is green, commit and push can run in the same autonomous flow.

Use ship commands:

- `npm run ask:ship:baseline -- --message "chore: ..."`
- `npm run ask:ship:phase1 -- --message "feat: ..."`
- `npm run ask:ship:phase2 -- --message "feat: ..."`
- `npm run ask:ship:phase3 -- --message "feat: ..."`
- `npm run ask:ship:phase4 -- --message "feat: ..."`
- `npm run ask:ship:phase5 -- --message "feat: ..."`
- `npm run ask:ship:phase6 -- --message "feat: ..."`

Or set default message via env:

```bash
ASK_AUTONOMY_COMMIT_MESSAGE="feat: runtime update" npm run ask:ship:phase2
```

Ship behavior:
- run phase verification first
- abort immediately if verification fails
- stage all changes, commit, then push
- use `git push -u <remote> <branch>` if no upstream exists

## Runner

Phase runner script:
- `scripts/autonomy/runPhaseVerification.mjs`
- `scripts/autonomy/runAutonomousShip.mjs`

Behavior:
- runs phase-specific test sets in sequence
- skips phase test files that do not exist yet
- runs repo baseline tests as final guard
- exits non-zero on first failing command

Dry run:

```bash
node scripts/autonomy/runPhaseVerification.mjs --phase phase1 --dry-run
```

## Enterprise Notes

- Superpowers integration refers to external provider `https://github.com/obra/superpowers`.
- ASK must keep adapter-only coupling to workflow providers.
- Keep provider version pinning, skill allowlists, compatibility checks, and kill-switch fallback in policy.
