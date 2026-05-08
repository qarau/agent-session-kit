# Future OHDER Runtime Boundaries

This document separates what OHDER does today from what ASK Forge is intentionally evolving toward. It prevents future-facing language from being mistaken for implemented runtime behavior.

## Current

Current OHDER capabilities are implemented in ASK Forge as governed, deterministic runtime checks:

- OHDER architect assessment during `ask slice close <taskId>`.
- Hard and soft law-pack evaluation through `.ask/policy/ohder-law-pack.json`.
- Architecture score output with weighted categories.
- Analyzer output for coupling, durability, authority, security boundary, and complexity/SRP.
- Slice-close entropy capture into `.ask/runtime/metrics-history.ndjson`.
- OHDER-driven `ask next` fallback actions.
- Refactor recommendation, preview, approval, materialization, and close outcome validation.
- Runtime mode visibility through `ask architect status`, `ask governance status`, `ask governance explain`, and `ask project-state`.
- Patch readiness evaluation through `OhderPatchReadinessGate`.

Operator rule: treat these as active runtime behavior.

## Partial

Partial capabilities are implemented enough to guide governed development, but still need deeper runtime expansion:

- Security boundary analysis currently detects path/content signals, matching-test gaps, and bypass/credential-sensitive changes. It does not yet perform semantic taint analysis or identity-provider policy verification.
- Refactor target discovery reads slice commits, changed files, entropy history, and completed refactor tasks. It does not yet perform whole-program architectural clustering.
- Entropy measurement tracks deterministic architecture and behavior dimensions. It does not yet forecast long-horizon maintainability cost.
- Runtime modes (`fast`, `strict`, `refactor`) are policy-visible and affect governance behavior, but they are not yet full strategy profiles with separate analyzer thresholds per subsystem.

Operator rule: use partial capabilities as governance evidence, not as proof that every architectural concern has been exhaustively analyzed.

## Planned

Planned capabilities are expected next steps, but they should not be described as current enforcement:

- Deeper security analyzers for authentication, authorization, secrets, token lifecycle, and permission drift.
- SSoT and event-only synchronization analyzers with first-class facts beyond the current law-pack placeholders.
- More specific refactor recommendation engines that can propose multiple ranked targets with clearer execution tradeoffs.
- Runtime-mode profiles that tune analyzer thresholds, required evidence, and close behavior by repository maturity.

Implementation prerequisites:

- Stable fact schemas for each new analyzer.
- Contract tests showing how each fact maps to OHDER law-pack behavior.
- Replay events that make every analyzer decision reconstructable.
- Operator playbooks for warnings, blocks, exemptions, and recovery.

## Future

Future capabilities describe the longer autonomous-governance direction. These are not implemented runtime guarantees today.

IDEA-aware runtime:

- Would classify product intent, domain impact, architectural risk, and implementation shape before slice creation.
- Requires stable requirement taxonomy, project-domain memory, and evidence that intent classification improves slice quality.

Architectural councils:

- Would evaluate major changes through multiple specialized architecture perspectives before execution.
- Requires deterministic council roles, conflict resolution rules, and replayable decision envelopes.

Autonomous entropy reduction:

- Would let ASK create and sequence repair work when entropy signals regress and safe targets are available.
- Requires high-confidence target discovery, bounded blast-radius policies, and approval rules for medium/high-risk refactors.

High-confidence autonomous patch application:

- Would allow ASK to authorize narrow implementation patches when the plan, tests, risk, and rollback path are all explicit.
- Requires patch-scope constraints, stronger proof of test relevance, rollback evidence, and operator-approved autonomy policy.
- Current boundary: ASK can report `patchReady: true` when confidence, blast radius, tests, rollback, approval, semantic facts, and clean worktree evidence are sufficient. It still returns `patchExecutionAllowed: false`; no autonomous patch application is enabled.

Operator rule: future capabilities can guide roadmap planning, but implementation claims must stay tied to tested runtime behavior.
