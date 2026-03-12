# ASK Core Pre-Commit Cutover Design

Date: 2026-03-12
Status: Approved
Branch: `ask-runtime`
Scope: Phase-4 staged adapter cutover with strict parity for pre-commit first, pre-push remaining hybrid.

## 1. Architecture

### 1.1 Cutover strategy
- Use staged cutover:
  - phase-4 targets `pre-commit` only;
  - `pre-push` remains hybrid and unchanged until parity follow-up.

### 1.2 Strict parity requirement
- Pre-commit cutover is allowed only with strict behavioral parity versus legacy checks.
- Ask-core must cover pre-commit responsibilities currently split across:
  - work-context validation
  - session-doc freshness validation for meaningful staged changes
  - lifecycle-aware preflight and can-commit policy gates

### 1.3 Single command contract
- Add a new ask-core command:
  - `ask pre-commit-check`
- The adapter invokes one command for deterministic hook semantics.

## 2. Command Contract

### 2.1 Output and exit behavior
- `ask pre-commit-check` returns JSON:
  - `{ passed: boolean, missing: string[], checks: string[] }`
- Exit code:
  - `0` when `passed=true`
  - `1` otherwise

### 2.2 Required check identifiers
- Stable `checks[]` values:
  - `work-context`
  - `docs-freshness`
  - `session-preflight`
  - `session-can-commit`

### 2.3 Failure messaging
- Deterministic `missing[]` entries for hook/adapters/tests, e.g.:
  - `work context mismatch for pre-commit`
  - `session docs freshness required`
  - `session state blocked not allowed for preflight`

### 2.4 Scope boundaries
- `pre-commit-check` replaces legacy pre-commit script invocations in adapter path.
- It does not change `pre-push` flow in phase-4.

## 3. Adapter Rollout

### 3.1 Phase-4A: Runtime command implementation
- Implement `pre-commit-check` and contract tests in ask-core.

### 3.2 Phase-4B: Adapter cutover
- Update `runPreCommitAdapter` to use ask-core-only pre-commit contract.
- Remove direct legacy calls from pre-commit adapter:
  - `kit/scripts/session/verifyWorkContext.mjs`
  - `kit/scripts/session/verifySessionDocsFreshness.mjs`

### 3.3 Phase-4C: Hybrid pre-push hold
- Keep `runPrePushAdapter` behavior unchanged.
- Document remaining hybrid delta and migration boundary.

## 4. Testing and Verification

### 4.1 Contract tests
- Add ask-core tests for `pre-commit-check` pass/fail matrix:
  - clean valid state passes
  - context mismatch fails
  - docs freshness missing fails
  - lifecycle policy failures fail

### 4.2 Adapter migration tests
- Update adapter tests to assert pre-commit flow is ask-core-only.
- Preserve existing pre-push behavior verification.

### 4.3 Verification gate
- Full repository tests.
- ask-core contract suite including `pre-commit-check`.
- adapter wrappers:
  - `scripts/session/runAskCorePreCommitAdapter.mjs`
  - `scripts/session/runAskCorePrePushAdapter.mjs`
- docs/bootstrap regression tests.

## 5. Documentation

### 5.1 Maintainer-facing updates
- State clearly:
  - pre-commit is ask-core strict-parity cutover complete,
  - pre-push remains hybrid in current phase.

### 5.2 Operator-facing clarity
- Document the new command and output contract.
- Document deterministic check IDs and failure categories.
