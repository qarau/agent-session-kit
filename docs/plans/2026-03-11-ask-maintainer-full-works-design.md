# ASK Maintainer Full Works Design

Date: 2026-03-11
Status: Approved
Scope: Dogfood full ASK maintainer workflow inside `agent-session-kit` first, then extract reusable maintainer mode after proving it across 1-2 release cycles.

## 1. Architecture

### 1.1 Session control plane (tracked)
- Continue using `docs/session/*` as the operational source of truth for current task state, open loops, and verification evidence.
- Keep entries concise and structured for team readability.

### 1.2 Release control plane (tracked)
- Use `docs/releases/*` as release governance source of truth.
- Enforce consistency across release notes, release ledger, checklist completion evidence, and `releases/latest.md`.

### 1.3 Automation and enforcement
- Reuse existing ASK hooks and validators as primary enforcement.
- Extend maintainer-focused checks for release doc consistency and evidence integrity without creating parallel workflows.

### 1.4 Maintainer runtime (local-only)
- Use `docs/ASK_Runtime/*` as local private runtime/scratch space.
- Runtime files are never a governance source of truth and are never pushed.

## 2. Data Flow and Push Lifecycle

### 2.1 Feature branches
- Run checks in advisory mode (warn-only).
- Do not block commits/pushes for session doc freshness on feature branches.

### 2.2 Protected branches (`main` and `release/*`)
- Run checks in enforce mode (fail-closed).
- Require concise updates in `docs/session/*` and release artifacts when applicable.
- Block push if release mapping/checklist/latest pointers are inconsistent.

### 2.3 Noise control rules
- Never track `docs/ASK_Runtime/*`.
- Keep `docs/session/change-log.md` entries short and structured (decision, action, verification).
- Regularly archive older sections to keep diffs small.

### 2.4 Release event flow
- Before release push: verify checklist, version docs, and latest pointers.
- On successful release prep: write a compact evidence entry (not transcript-level logs).

## 3. Error Handling and Failure Behavior

### 3.1 Fail-closed on protected branches
- Validation failures block commit/push on `main` and `release/*`.
- Output must identify the exact failing file/check and direct fix command(s).

### 3.2 Fail-open on feature branches
- Equivalent checks surface warnings but do not block normal development flow.

### 3.3 Expected failure classes
- Missing or stale `docs/session/*` entries.
- Release docs out of sync (`docs/releases/latest.md`, release ledger, release notes, checklist state).
- Attempted inclusion of local-only runtime artifacts.

### 3.4 Recovery path
- Every blocking failure prints a short, deterministic next-step sequence.
- No ambiguous instructions requiring manual interpretation.

### 3.5 Safety constraints
- Never auto-rewrite release governance docs silently.
- Preserve human-reviewed doc updates for traceability.

## 4. Testing and Verification Strategy

### 4.1 Unit tests
- Validate branch mode detection (`feature` vs `main`/`release/*`).
- Validate release consistency checks and failure message quality.

### 4.2 Hook integration tests
- Verify feature branch flows remain warn-only.
- Verify protected branch flows pass with correct docs.
- Verify protected branch flows block on stale/missing docs.

### 4.3 Noise-control tests
- Ensure `docs/ASK_Runtime/*` cannot be committed.
- Validate `docs/session/change-log.md` entry shape stays concise and structured.

### 4.4 Pre-completion verification
- Run full relevant test suite and targeted workflow checks.
- Dry-run release checklist validation.
- Record compact verification evidence in session/change log.

## 5. Rollout Plan

### Phase 1 (now): Internal dogfooding in `agent-session-kit`
- Enable full maintainer discipline in this repository using existing ASK controls plus targeted maintainer checks.

### Phase 2 (after 1-2 release cycles): Reusable maintainer mode extraction
- Extract only proven conventions and checks into reusable templates/scripts for downstream repositories.

