# ASK Core Session Lifecycle Depth Design

Date: 2026-03-12
Status: Approved
Branch: `ask-runtime`
Scope: Expand `ask-core` session lifecycle to full-audit transitions with transactional snapshot+journal persistence.

## 1. Architecture

### 1.1 Persistence model
- Keep fast-read session snapshot in `.ask/sessions/active-session.json`.
- Add append-only transition journal at `.ask/sessions/history.ndjson`.
- Use transactional marker file `.ask/sessions/pending-transition.json` for write durability.

### 1.2 Transaction flow (approach 3)
- For each lifecycle transition command:
  1. Write `pending-transition.json` with the proposed transition payload.
  2. Append event line to `history.ndjson`.
  3. Project and persist `active-session.json`.
  4. Remove `pending-transition.json`.
- If command startup finds a stale pending marker, run deterministic recovery and re-project to a consistent snapshot.

### 1.3 Runtime boundary
- `SessionRuntime` owns state validation, transition authoring, and persistence orchestration.
- CLI command handlers stay thin and delegate transition requests to runtime APIs.
- Existing adapter flows remain unchanged in phase 2A (no hook behavior changes yet).

## 2. State Machine and Command Contracts

### 2.1 Canonical lifecycle states
- `created`
- `active`
- `paused`
- `resumed`
- `blocked`
- `closed`

### 2.2 Valid transitions
- `created -> active`
- `active -> paused | blocked | closed`
- `paused -> resumed | closed`
- `resumed -> paused | blocked | closed` (projection state returns to `active` after `resumed`)
- `blocked -> resumed | closed`

### 2.3 Session command surface
- `ask session start`
- `ask session pause --reason "..."`
- `ask session resume --reason "..."`
- `ask session block --reason "..."`
- `ask session close --reason "..."`
- `ask session status`

### 2.4 Event payload contract
Each transition event records:
- `sessionId`
- `from`
- `to`
- `at`
- `reason`
- `actor` (optional)
- `branch`
- `worktree`
- `repoRoot`
- `sourceCommand`

### 2.5 Invalid transition behavior
- Return exit code `1`.
- Emit deterministic JSON error payload with:
  - `ok: false`
  - `code: "invalid-transition"`
  - `from`, `to`, `allowed[]`
  - message suitable for hook/adapters.

## 3. Recovery and Migration

### 3.1 Recovery rules
- If `pending-transition.json` exists:
  - verify whether the event exists in `history.ndjson`;
  - if present, complete snapshot projection and clear pending marker;
  - if absent, fail safely with machine-readable recovery instructions.

### 3.2 Legacy snapshot migration
- Existing `.ask/sessions/active-session.json` remains readable.
- On first phase-2 lifecycle command:
  - bootstrap `history.ndjson` with synthetic lineage entries to preserve compatibility;
  - continue all future writes through transaction+journal flow.

## 4. Testing and Verification Strategy

### 4.1 Runtime contract tests
- Add tests for each valid transition.
- Add tests for each invalid transition and JSON error shape.
- Add tests for journal append and snapshot projection consistency.

### 4.2 Recovery tests
- Simulate interrupted transition with existing pending marker.
- Verify deterministic recovery and consistent final snapshot/journal state.

### 4.3 CLI tests
- Validate command exit codes and required reason args for pause/resume/block/close.
- Validate `session status` output for current state + latest transition metadata.

### 4.4 Verification gate
- `npm run test`
- `node --test ask-core/tests/sessionLifecycle.contract.test.mjs`
- Existing ask-core contract suite remains green.

## 5. Rollout Boundaries

### Phase 2A (this design)
- Implement lifecycle engine depth and command contracts in `ask-core`.
- Keep adapter behavior stable.

### Phase 2B (follow-up)
- Consume richer lifecycle status in `preflight` and `can-commit` policy decisions.

### Phase 2C (follow-up)
- Define cutover parity criteria and remove remaining legacy validation path.
