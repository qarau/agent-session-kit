# ASK Forge v6.0.0 Release Alignment Plan

## Summary

Align ASK Forge release metadata, README positioning, and v6.0.0 release notes with the completed TypeScript contract and runtime-boundary migration work. The final release tag must point to the committed release-alignment state.

## Goals

- Set package metadata to `6.0.0`.
- Update README so the opening summary clearly states the ASK Forge advantage.
- Make README reflect `v6.0.0` as the current release instead of a draft.
- Expand the v6.0.0 release note to include the completed runtime-boundary waves.
- Keep changes documentation/version-only; no runtime behavior changes.

## Slices

### 001 v6 Release Alignment

Update release-facing files and docs tests for the v6.0.0 release.

Acceptance criteria:

- `package.json` and `package-lock.json` use version `6.0.0`.
- README current release line says `v6.0.0` and no longer calls v6 a draft.
- README opening summary explains the ASK Forge advantage: governed plan-to-slice execution, evidence-before-commit, OHDER governance, replayable history, and clear boundaries for Codex and Superpowers.
- README v6 section mentions TypeScript contracts plus Governance/OFRR, EventLedger, RuntimeSnapshotStore, TaskRuntime, TaskBoardProjector, PlanBatchRegistry, and SliceCloseRuntime boundary waves.
- `docs/releases/v6.0.0.md` explains the shift from v5.0/v5.1 to v6.0.0 and lists the completed boundary waves.
- Documentation contract tests cover the updated release/current-line claims.

## Validation

Targeted validation:

- `node --test ask-core/tests/v6Documentation.contract.test.mjs`
- `node --test ask-core/tests/ohderSemanticAutonomyDocs.contract.test.mjs`
- `node --test ask-core/tests/implementationBoundaryDocs.contract.test.mjs`

Final validation:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `node ask-core/bin/ask.js pre-push-check`
