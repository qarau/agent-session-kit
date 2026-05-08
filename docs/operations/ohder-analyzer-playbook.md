# OHDER Analyzer Playbook

Use this playbook when `ask architect status` shows analyzer warnings but no hard-law block.

## Coupling Warnings

- Inspect `couplingAnalysis.crossLayerImports`.
- If core imports CLI, move the dependency behind a core-owned contract or an adapter boundary.
- Re-run the targeted tests and `ask slice close <taskId>`.

## Durability Warnings

- Inspect `durabilityAnalysis.touchpoints`.
- For projector, snapshot, ledger, sequence, policy, or migration changes, run replay or projection validation before closing.
- Treat migrations and snapshot format changes as approval-worthy even if OHDER only warns.

## Authority Warnings

- Inspect `authorityAnalysis.violations`.
- Replace direct `.ask` state writes with approved authorities such as `RuntimeSnapshotStore`, `RuntimeProjectionEngine`, `EventLedger`, `SequenceStore`, `FileStore`, or `Scaffolder`.
- Do not add exemptions for permanent duplicate authority paths.

## Security Boundary Warnings

- Inspect `securityAnalysis.filesAnalyzed` and `securityAnalysis.findings`.
- Add matching tests for auth, token, permission, session, credential, or bypass-sensitive changes.
- Treat `securityAnalysis.boundaryValid: false` as a hard-law issue in strict mode; fix the guardrail gap before closing the slice.

## Complexity And SRP Warnings

- Inspect `complexityAnalysis.filesAnalyzed`.
- Split mixed concerns before adding more behavior to high-complexity files.
- Prefer a new refactor slice if the feature slice is already passing but complexity pressure is rising.

## Refactor Execution Plan Responses

- `split-doc-section`: move deep runtime detail out of README or broad playbooks into focused operations docs and cross-link it.
- `reduce-cross-layer-import`: remove outer-layer imports from inner runtime layers.
- `extract-responsibility`: isolate one concern and preserve behavior with focused contract tests.
