# ASK Core Next Phase Design

Date: 2026-03-11
Status: Approved
Branch: `ask-runtime`
Scope: Launch standalone `ask-core/` first, with one real adapter migration from current ASK scripts as proof.

## 1. Architecture

### 1.1 Standalone runtime package
- Create `ask-core/` as an independent package and runtime kernel.
- `ask-core` owns core contracts for:
  - session runtime
  - context verification
  - policy checks
  - continuity store
  - evidence recorder
  - handoff lifecycle

### 1.2 Adapter-proof requirement for phase 1
- Migrate one real current-ASK script slice into an adapter path that executes through `ask-core`.
- Recommended migrated proof slice:
  - context verification
  - docs/evidence freshness checks
  - release-doc consistency checks
  - surfaced through `ask preflight` and `ask can-commit`

### 1.3 Separation boundary
- `ask-core` is the platform-agnostic source of truth.
- Existing repository scripts become adapter/migration layer that calls `ask-core` contracts.
- No new governance logic should be added only in legacy scripts.

### 1.4 Phase-1 outcome
- Runnable `ask-core` CLI with real governance behavior.
- One migrated adapter path proving parity with existing ASK behavior.

## 2. Data Flow and Lifecycle

### 2.1 Session lifecycle
- `ask session start|resume|status|close` reads/writes `.ask/sessions/active-session.json`.
- Continuity artifacts under `.ask/continuity/*` are updated at lifecycle boundaries and handoffs.

### 2.2 Context lifecycle
- `ask context verify` resolves and stores repo, branch, and worktree in `.ask/state/work-context.json`.
- `ask preflight` evaluates:
  - active session state
  - verified context
  - policy requirements
- `ask preflight` returns pass/fail plus missing requirements.

### 2.3 Commit-readiness lifecycle
- `ask can-commit` evaluates evidence + policy requirements.
- Output contract is machine-readable:
  - `ok`
  - `missing[]`
- Adapters can render advisory or enforce behavior based on branch/risk mode.

### 2.4 Adapter-proof flow
- A current ASK script entrypoint is migrated to call `ask preflight` + `ask can-commit`.
- Hook-compatible messaging remains, but decision logic is delegated to `ask-core`.

## 3. Error Handling and Failure Behavior

### 3.1 Deterministic failures
- Runtime commands must return explicit missing requirements.
- Failure classes include:
  - missing active session
  - stale/missing evidence
  - context mismatch
  - policy violation

### 3.2 Policy-driven strictness
- Core evaluates risk/policy consistently.
- Adapters can choose advisory vs enforce presentation, but cannot silently bypass required checks.

### 3.3 Recovery guidance
- Failed commands provide deterministic next actions (human and agent actionable).
- Examples:
  - `ask context verify`
  - refresh continuity files
  - record tests/check outputs in evidence files

### 3.4 Safety constraints
- No hidden mutation on validation failure.
- Handoff validation must pass required fields before transfer-ready state.
- Commit-readiness checks remain evidence-based and read-only.

## 4. Testing and Verification Strategy

### 4.1 Runtime contract tests (`ask-core`)
- CLI command tests:
  - `session`
  - `context`
  - `preflight`
  - `can-commit`
  - `handoff`
- Filesystem contract tests for `.ask/*` layout and persisted state.
- Policy/evidence matrix tests for pass/fail and `missing[]` output semantics.

### 4.2 Adapter proof tests
- Integration tests verifying one migrated current-ASK flow executes via `ask-core`.
- Preserve hook-facing output compatibility expectations.

### 4.3 Regression parity checks
- For migrated slice, compare outcomes vs existing scripts across:
  - healthy state
  - missing docs/evidence
  - wrong branch/worktree context

### 4.4 Completion gate
- Run full repository test suite.
- Run new `ask-core` test suite.
- Validate migrated adapter flow end-to-end in `ask-runtime` worktree.
- Record compact verification evidence in session docs.

## 5. Phase Definition

### In scope
- Standalone `ask-core` package bootstrap and hardening.
- Core runtime contracts for session/context/preflight/can-commit/handoff.
- One real migrated adapter path from current ASK scripts.

### Out of scope (defer)
- Full migration of all legacy scripts.
- Rich UI/dashboard layers.
- Multi-adapter ecosystem expansion beyond initial proof.

