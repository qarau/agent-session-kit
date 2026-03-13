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

## Runner

Phase runner script:
- `scripts/autonomy/runPhaseVerification.mjs`

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
