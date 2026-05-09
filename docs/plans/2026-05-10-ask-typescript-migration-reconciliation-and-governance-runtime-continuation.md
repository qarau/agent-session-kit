# ASK TypeScript Migration Reconciliation And Governance Runtime Continuation Plan

## Summary
Reconcile `ask_forge_type_script_migration_implementation_spec_v_1_red.md` against the actual repo state before continuing the TypeScript migration. This prevents duplicate `ask-ts-011/012` work, records that project detection and adapter resolution were completed under `ask-adapter-*`, then continues with the next real migration area: governance findings, OFRR resolutions, and governance explain output.

## Slice 1: TypeScript Migration Spec Reconciliation
Create a migration status document that maps spec slices `ask-ts-001` through `ask-ts-022` to completed commits, completed alternate slice IDs, partial work, and remaining work.

Acceptance criteria:
- The status doc marks `ask-ts-001` through `ask-ts-010` as completed by the v6 TypeScript contract foundation.
- The status doc marks spec `ask-ts-011` and `ask-ts-012` as completed by `ask-adapter-002`, `ask-adapter-003`, and `ask-adapter-004`.
- The status doc identifies the next true unfinished area as governance/OFRR runtime typing, not adapter detection duplication.
- The doc includes a clear “do not duplicate” note for completed adapter work.
- No runtime behavior changes.

## Slice 2: Governance And OFRR Contract Gap Audit
Audit existing governance contracts and runtime outputs against spec `ask-ts-013`, `ask-ts-014`, and `ask-ts-015`.

Acceptance criteria:
- Add or update contract tests that compare current OHDER finding, OFRR resolution, and governance explain outputs against `ask-core/src/contracts/governance.ts`.
- Identify whether each gap is contract-only, runtime-shape drift, or missing runtime helper typing.
- Preserve OFRR as record-only with no blocking behavior change.
- Existing governance explain, architect finding, and OFRR tests still pass.

## Slice 3: Typed Governance Runtime Boundary
Add a small TypeScript-facing governance boundary module that exports typed helpers or fixtures for current governance finding and OFRR resolution shapes without converting the full runtime yet.

Acceptance criteria:
- Current OHDER finding records can be represented by exported TypeScript types.
- Current OFRR resolution records can be represented by exported TypeScript types.
- The boundary does not change persisted `.ask` artifact shape.
- The boundary does not change blocking behavior.
- `npm run typecheck`, `npm run build`, and targeted governance tests pass.

## Slice 4: Governance Explain Contract Stability
Stabilize the contract coverage for `ask governance explain` so future runtime migration cannot accidentally drift the public report shape.

Acceptance criteria:
- Add representative governance explain fixture coverage.
- The fixture includes findings, resolutions or resolution state when available, active blockers or warnings, and recommended actions.
- Contract tests verify required top-level fields and tolerate additive fields.
- No CLI output field is renamed.
- Existing governance surface tests pass.

## Slice 5: Continuation Plan Update
Update migration docs to show the corrected next build order after reconciliation.

Acceptance criteria:
- Docs state that adapter wrapper, project detection, and adapter resolution are already complete.
- Docs identify the next recommended implementation sequence after this plan.
- Docs avoid claiming full TypeScript runtime migration is complete.
- Docs preserve the v6 framing: contracts first, runtime conversion later, strictness last.
- ASK ready-plan and slice-close governance remain the required workflow.

## Test Plan
Run targeted tests:
- `node --test --test-concurrency=1 ask-core/tests/checkGovernanceContracts.contract.test.mjs`
- `node --test --test-concurrency=1 ask-core/tests/ohderFindingResolution.contract.test.mjs`
- `node --test --test-concurrency=1 ask-core/tests/governanceSurface.contract.test.mjs`
- `node --test --test-concurrency=1 ask-core/tests/contractJsonFixtures.contract.test.mjs`

Run full gates:
- `npm run typecheck`
- `npm run build`
- `npm test`
- `node ask-core/bin/ask.js pre-push-check`

## Assumptions
- The next implementation should not recreate `ask project detect` or `ask adapter resolve`.
- Existing JavaScript runtime behavior remains authoritative during this phase.
- TypeScript continues as a contract and boundary layer, not a big-bang rewrite.
- OFRR remains record-only unless a separate spec explicitly changes governance blocking behavior.
- Each slice must be started and closed through ASK, producing one governed slice commit per passing slice.
