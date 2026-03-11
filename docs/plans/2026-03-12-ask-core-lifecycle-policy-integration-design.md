# ASK Core Lifecycle Policy Integration Design

Date: 2026-03-12
Status: Approved
Branch: `ask-runtime`
Scope: Make `preflight` and `can-commit` lifecycle-aware using explicit policy-configured allowed session states.

## 1. Architecture

### 1.1 Policy keys
- Extend `defaultPolicyYaml` session section with:
  - `allowed_preflight_states`
  - `allowed_can_commit_states`
- Default values for both:
  - `active,paused`

### 1.2 Runtime command behavior
- `ask preflight` continues returning `{ passed, missing }`.
- `ask can-commit` continues returning `{ ok, missing }`.
- Both commands now evaluate lifecycle status against policy-defined allowed states.
- Existing checks remain intact:
  - context checks in `preflight`
  - evidence checks in `can-commit`

### 1.3 Compatibility constraints
- No adapter rewiring required in phase-3.
- Payload structure remains backward-compatible for wrappers/hooks.
- Lifecycle-state checks only add deterministic missing entries.

## 2. Contract Semantics

### 2.1 Allowed states for this phase
- Pass:
  - `active`
  - `paused`
- Fail:
  - `blocked`
  - `closed`
  - `created`

### 2.2 Preflight semantics
- If session state not in `allowed_preflight_states`, append lifecycle failure to `missing`.
- Exit code is `1` when any missing requirement exists.

### 2.3 Can-commit semantics
- Evidence checks still run (`docsFresh`, `testsPassed`).
- If session state not in `allowed_can_commit_states`, append lifecycle failure to `missing`.
- Exit code is `1` when any missing requirement exists.

### 2.4 Deterministic failure messages
- Missing entries use explicit lifecycle context, e.g.:
  - `session state blocked not allowed for preflight`
  - `session state closed not allowed for can-commit`

## 3. Testing Strategy

### 3.1 Contract matrix extension
- Extend `ask-core/tests/preflightCanCommit.contract.test.mjs` with lifecycle matrix tests:
  - preflight passes for `active`, `paused`
  - preflight fails for `blocked`, `closed`, `created`
  - can-commit passes for `active`, `paused` when evidence is true
  - can-commit fails for `blocked`, `closed`, `created` even if evidence is true

### 3.2 Regression scope
- Keep existing failing-path tests for missing context/evidence.
- Ensure lifecycle checks do not break current adapter entrypoints.

## 4. Rollout and Documentation

### 4.1 Rollout boundary
- Phase-3 integrates lifecycle policy awareness only.
- Full legacy check removal remains out-of-scope.

### 4.2 Documentation updates
- Update `ask-core/README.md` with lifecycle-gated preflight/can-commit behavior.
- Update root `README.md`, `docs/how-it-works.md`, and `docs/maintainer-mode.md` with policy semantics.

### 4.3 Verification gate
- `cmd /c npm run test`
- ask-core contract suite including lifecycle-aware preflight/can-commit checks
- adapter wrappers:
  - `scripts/session/runAskCorePreCommitAdapter.mjs`
  - `scripts/session/runAskCorePrePushAdapter.mjs`
