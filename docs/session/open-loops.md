# Open Loops

## 1) Ask-Core Full Cutover Criteria

- Issue: Define the objective threshold for removing legacy ASK script checks from adapter wrappers and relying on ask-core only.
- Owner: ASK maintainers.
- Decision needed: What minimum parity matrix (commands, hooks, branch modes, release checks) is required before cutover.
- Current state: Lifecycle depth plus lifecycle-aware preflight/can-commit policy gating are implemented; adapters still run dual-path checks for safety.
- Default if no response: Keep dual-execution adapters and defer hard cutover until parity criteria are documented and validated.

## 2) Main Release Integration Path

- Issue: Choose merge strategy for phase-3 lifecycle-policy integration changes into protected release flow.
- Owner: ASK maintainers.
- Decision needed: Merge directly to `main` after review vs stage via release candidate branch.
- Current state: Phase-3 lifecycle-policy integration is complete in `ask-runtime` with verification evidence recorded.
- Default if no response: Request review, then merge to `main` with standard protected-branch checks.

## 3) Pending Marker Escalation Policy

- Issue: Define maintainer handling for `pending-transition.json` that does not match journal history.
- Owner: ASK maintainers.
- Decision needed: Should unmatched pending markers block adapters, emit advisory warnings, or trigger automated repair mode.
- Current state: Runtime auto-recovers only when pending event is already present in `history.ndjson`.
- Default if no response: Keep conservative behavior (no implicit repair), surface issue for manual maintainer action.

## 4) Lifecycle Policy Override Governance

- Issue: Define team policy for downstream repos overriding `allowed_preflight_states` / `allowed_can_commit_states`.
- Owner: ASK maintainers.
- Decision needed: Require maintainer approval for non-default overrides vs allow free local customization.
- Current state: Defaults are explicit (`active,paused` allowed; `blocked,closed,created` rejected), but override governance is undocumented.
- Default if no response: Require documented maintainer approval for non-default lifecycle-state overrides.
