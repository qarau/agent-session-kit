# ASK Core Hard Cutover Design

Date: 2026-03-12  
Status: Approved (Option 2: internal phased commits, single release boundary)

## 1) Goal

Remove all legacy ASK runtime execution paths and make `ask-core` the sole runtime authority for commit/push governance.

## 2) Scope

In scope:

- Eliminate runtime calls to `kit/scripts/session/*`.
- Remove hybrid `pre-push` behavior and move to ask-core-only checks.
- Move release-doc consistency logic into ask-core.
- Remove installer/runtime dependence on copied `kit` scripts in target repos.
- Update hooks, docs, and tests to ask-core-only semantics.

Out of scope:

- Backward-compatibility shims for legacy `scripts/session/*` commands.
- Dual-path transition period after cutover.

## 3) Current Legacy Surface (to remove)

- `ask-core/src/adapters/sessionKit/runPrePushAdapter.js` invokes:
  - `kit/scripts/session/verifyWorkContext.mjs`
  - `kit/scripts/session/verifySessionDocsFreshness.mjs`
  - `kit/scripts/session/verifyReleaseDocsConsistency.mjs`
- `install-session-kit.mjs` copies full `kit/` payload as installed runtime surface.
- `.githooks/post-commit` references `kit/scripts/session/nextTask.mjs`.
- `scripts/verifyReleaseDocsConsistency.mjs` imports `kit/.../releaseDocsConsistencyCore.mjs`.
- Docs/tests still describe or validate hybrid/legacy runtime behavior.

## 4) Target Runtime Architecture

### 4.1 Single runtime authority

All enforcement decisions run through ask-core CLI/core:

- `ask pre-commit-check` (already canonical for pre-commit).
- New `ask pre-push-check` command for push governance.

### 4.2 Adapter behavior

- `runPreCommitAdapter` remains ask-core-only.
- `runPrePushAdapter` becomes ask-core-only (no direct legacy script execution).

### 4.3 Policy/engine ownership

ask-core owns:

- work-context parity checks
- session docs freshness checks by mode (`pre-commit`, `pre-push`, `preflight`)
- release-doc consistency checks
- lifecycle policy gating (`preflight`, `can-commit`)

## 5) Component Design

### 5.1 New ask-core command/engine

Add `pre-push-check` command and engine that returns deterministic JSON contract:

```json
{
  "passed": false,
  "missing": ["..."],
  "checks": ["work-context", "docs-freshness", "release-docs", "session-preflight", "session-can-commit"]
}
```

Exit behavior: `process.exitCode = 1` when `passed === false`.

### 5.2 Release docs core migration

Move release-doc consistency verification core into ask-core (library-style core module), then route CLI/adapter checks through it.

### 5.3 Installer and hooks

- Installer provisions runtime hooks/wrappers and ask-core assets without requiring installed `kit/scripts/session/*` runtime validators.
- Post-commit reminder path must no longer call `kit/...`; either ask-core-backed reminder or explicit no-op.

### 5.4 Legacy deletion

Delete legacy runtime validators and hook templates that are no longer referenced by installer, adapters, tests, or docs.

## 6) Testing and Verification Strategy

Test-first contract approach:

1. Add failing ask-core tests for `pre-push-check` pass/fail matrix.
2. Add failing adapter migration test proving pre-push succeeds without legacy `kit/scripts/session/*` in temp repo.
3. Implement minimal ask-core logic to pass tests.
4. Update smoke tests/docs tests to enforce ask-core-only wording and behavior.
5. Run full verification:
   - `npm run test`
   - ask-core contract suite including `pre-push-check`
   - adapter wrapper runs for pre-commit + pre-push

## 7) Delivery Plan (Option 2)

### Slice A

ask-core pre-push contracts + engine.

### Slice B

Pre-push adapter hard cutover to ask-core-only.

### Slice C

Installer and hook runtime cleanup (no `kit` runtime dependency).

### Slice D

Docs/tests de-legacy and dead code deletion.

### Slice E

Final verification and session evidence capture.

## 8) Risks and Mitigations

- Risk: hidden legacy references survive deletion.
  - Mitigation: grep gates in tests for `kit/scripts/session` runtime invocations.
- Risk: release governance regressions during core migration.
  - Mitigation: preserve and port existing release-doc contract tests before deleting legacy code.
- Risk: install path breakage for downstream repos.
  - Mitigation: maintain installer smoke coverage and run temp-repo installation tests in CI.

