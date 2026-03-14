# Open Loops

## 0) Runtime Stall Handling Reliability (Closed 2026-03-12)

- Issue: Runtime adapter checks could appear hung and require manual interrupt + resume.
- Owner: ASK maintainers.
- Resolution: Added guarded runtime execution and diagnostics in commits `9e2fb05`, `9ea1a5b`, `4aac026`, and `d8fd57b`.
- Current state: adapters now use `180s` stall detection with one automatic retry; `ask session doctor` reports last operation state.
- Follow-up: none.

## 1) Pre-Push Full Cutover Criteria (Closed 2026-03-12)

- Issue: Define threshold for moving pre-push from hybrid to ask-core-only execution.
- Owner: ASK maintainers.
- Resolution: Completed in hard-cutover commits `8dc109f`, `d77d652`, `d8c4748`, and `1c6bd84`.
- Current state: pre-commit and pre-push both run ask-core-only checks.
- Follow-up: none.

## 2) Main Release Integration Path (Hard Cutover)

- Issue: Choose merge strategy for hard-cutover branch into protected release flow.
- Owner: ASK maintainers.
- Decision needed: Merge directly to `main` after review vs stage via release candidate branch.
- Current state: Hard cutover is complete in `ask-hard-cutover` with verification evidence recorded.
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

## 5) ASK 3.0 Cutover Blocker: Guarded Runner Contract Reliability

- Issue: Full ask-core verification is not green; guarded-runner contract paths are timing out unexpectedly (4 failing tests including session-doctor success-path dependency).
- Owner: ASK maintainers.
- Decision needed: Keep bridge mode vs force hard cutover with known guarded-runner instability.
- Current state: Bridge mode retained after Task 13 evidence run (`npm test` pass, ask-core 64/68 with guarded-runner-linked failures).
- Default if no response: Keep bridge mode, prioritize guarded-runner/session-doctor reliability fixes before cutover.
