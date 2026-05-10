# ASK Forge TypeScript Migration Status

This document reconciles `docs/ASK/ask_forge_type_script_migration_implementation_spec_v_1_red.md` against the current ASK Forge repository state.

## Current Position

`ask-ts-001 through ask-ts-010` are completed by the v6 TypeScript contract foundation. Those slices established TypeScript tooling, current artifact contracts, event contracts, task/plan contracts, check/governance contracts, adapter contracts, profile/law-pack contracts, worker/queue contracts, JSON contract fixtures, and v6 documentation framing.

The adapter activation work from the original spec was completed under a separate governed plan:

- `ask-ts-011` is completed by `ask-adapter-002` and `ask-adapter-003`.
- `ask-ts-012` is completed by `ask-adapter-004`.

do not duplicate the completed adapter work. The completed adapter, governance, EventLedger, projection cursor, RuntimeSnapshotStore, TaskRuntime, and TaskBoardProjector waves should be referenced as existing capabilities, not regenerated under new TypeScript migration slice IDs.

Earlier reconciliation identified governance/OFRR runtime typing, not adapter detection duplication, as the next true unfinished area. That governance/OFRR foundation has since been completed; the phrase remains here as historical context for the completed reconciliation.

The adapter wrapper, project detection, and adapter resolution are already complete. They should be referenced as completed capabilities, not regenerated under new TypeScript migration slice IDs.

## Reconciliation Map

| Spec Slice | Current Status | Evidence |
| --- | --- | --- |
| `ask-ts-001` TypeScript tooling | Completed | `package.json`, `tsconfig.json`, `npm run typecheck`, `npm run build` |
| `ask-ts-002` Core contract directory | Completed | `ask-core/src/contracts/*` |
| `ask-ts-003` Typed runtime events | Completed foundation | `ask-core/src/contracts/events.ts`, `runtimeEventContracts.contract.test.mjs` |
| `ask-ts-004` Event ledger append/read conversion | Completed runtime compatibility conversion for this wave | Event contracts, EventLedger boundary contracts, runtime guard tests, typed runtime helpers, and source-compatible helper delegation exist |
| `ask-ts-005` Projection cursor state conversion | Completed projection cursor and snapshot/runtime boundary compatibility waves, full projection engine conversion remaining | Projection cursor contracts, replay proof contracts, runtime artifact fixtures, projection-state compatibility tests, RuntimeSnapshotStore contracts, typed helpers, and source-compatible helper delegation exist; projection engine implementation remains JavaScript |
| `ask-ts-006` Task and slice model conversion | Completed task runtime and task-board projector boundary waves; SliceCloseRuntime conversion remaining | `tasks.ts`, task contract tests, `TaskRuntimeHelpers.ts`, `TaskRuntimeHelpers.js`, typed invariant companion, `TaskBoardProjectorHelpers.ts`, `TaskBoardProjectorHelpers.js`, task-board characterization coverage, and source-compatible helper delegation exist |
| `ask-ts-007` Plan batch registry typing | Completed foundation, runtime conversion remaining | Plan batch contracts and fixtures exist |
| `ask-ts-008` Queue classification typing | Completed foundation | `queues.ts`, `workers.ts`, queue contract tests |
| `ask-ts-009` Adapter contract | Completed | `adapter.ts`, adapter fixture tests |
| `ask-ts-010` Node adapter wrapper | Completed by adapter runtime activation | `ask-core/src/adapters/language/node/index.js` |
| `ask-ts-011` Project detection | Completed by `ask-adapter-002` and `ask-adapter-003` | `ask project detect`, `projectDetectCli.contract.test.mjs` |
| `ask-ts-012` Active adapter resolution | Completed by `ask-adapter-004` | `ask adapter resolve`, `adapterResolveCli.contract.test.mjs` |
| `ask-ts-013` Governance findings typing | Completed foundation | Governance contracts and the TypeScript-facing runtime boundary exist; deeper runtime conversion remains |
| `ask-ts-014` OFRR resolutions typing | Completed foundation | OFRR contracts and the TypeScript-facing runtime boundary exist; OFRR remains record-only |
| `ask-ts-015` Governance explain output typing | Completed foundation | Governance explain report contract, fixture coverage, and additive CLI `recommendedActions` exist |
| `ask-ts-016` Law pack runtime contract/loading | Partial | Law-pack contracts exist; runtime loading remains JavaScript |
| `ask-ts-017` Project profile runtime contract/loading | Partial | Profile contracts exist; runtime profile helper remains minimal |
| `ask-ts-018` CLI entrypoint TypeScript conversion | Remaining | CLI remains JavaScript |
| `ask-ts-019` JS compatibility shim | Remaining | Needed only when CLI entrypoint moves to TypeScript |
| `ask-ts-020` Strict checks for contracts | Remaining | Current root TypeScript config is permissive |
| `ask-ts-021` Strict checks for runtime core | Remaining | Runtime core is still JavaScript-first |
| `ask-ts-022` Global strict checks | Remaining | Deferred until contracts/core strictness is stable |

## Completed Governance Continuation Area

The governance/OFRR contract foundation from this plan is now in place:

1. Audit current OHDER finding, OFRR resolution, and governance explain outputs against `ask-core/src/contracts/governance.ts`.
2. Add a small TypeScript-facing governance boundary for current finding and resolution shapes.
3. Stabilize `ask governance explain` fixture coverage.
4. Only then continue into deeper runtime conversion or strictness work.

Do not claim full TypeScript runtime migration is complete. ASK Forge v6 remains contracts first, runtime conversion later, strictness last.

## Governance + Event Ledger TypeScript Boundary Wave

The Governance + Event Ledger TypeScript Boundary wave is now in place:

1. governance report helper extraction is complete. `ask governance status` and `ask governance explain` still expose the same public CLI JSON fields, but report construction is now testable without spawning the CLI.
2. governance fixture decomposition is complete. `governanceFixtures.ts` remains the public facade while focused fixture modules hold check, OHDER, architect, and decision/explain fixtures.
3. EventLedger boundary hardening is complete. The TypeScript contract layer now represents append input, append result, read-all result, sequencing assumptions, payload preservation, and metadata preservation.
4. EventLedger runtime guard tests are complete. Current source-compatible runtime behavior is covered for payload/meta preservation, sequence ordering, and malformed NDJSON throwing.

The EventLedger implementation entered a compatibility conversion path after this boundary wave. The current source-run CLI still loads JavaScript, but append/read behavior now has typed helper coverage and a source-compatible helper seam.

governance runtime decomposition is complete for this wave. Deeper governance runtime conversion remains deferred until source-run CLI compatibility has a selected migration path.

projection cursor runtime conversion was the next deferred step after the ledger boundary work and is now complete for the boundary/compatibility wave. Projection cursor correctness is now covered through stable event ordering assumptions, replay proof contracts, cursor state contracts, and projection-state normalization tests.

## Projection Cursor TypeScript Runtime Boundary Wave

The Projection Cursor TypeScript Runtime Boundary wave is now in place:

1. projection cursor boundary/conversion is complete for this wave. The TypeScript contract layer now represents projection cursor state, replay proof, sequence integrity, projection run summaries, and representative runtime artifacts.
2. projection-state compatibility hardening is complete. `RuntimeSnapshotStore.readProjectionState()` and `writeProjectionState()` normalize missing or invalid cursor fields while preserving existing artifact paths and wire shape.
3. full projection engine TypeScript conversion remains deferred. `RuntimeProjectionEngine.js` still runs as source-compatible JavaScript while its cursor and replay artifact boundary is typed and tested.
4. EventLedger runtime compatibility conversion and RuntimeSnapshotStore boundary hardening followed this wave.

## EventLedger TypeScript Runtime Conversion Wave

The EventLedger TypeScript Runtime Conversion wave is now in place:

1. EventLedger runtime compatibility conversion is complete for this wave. Append envelope construction, NDJSON line parsing, and sequence sorting are now represented by typed runtime helpers and mirrored by a source-compatible JavaScript helper.
2. `EventLedger.js` still remains the source-run authority for current CLI compatibility, but it now delegates append/read behavior through `EventLedgerRuntime.js` instead of owning the behavior inline.
3. full source-only .ts runtime loading remains deferred until CLI build/shim strategy is selected. This avoids breaking current direct source execution while still moving behavior behind typed contracts.
4. event ledger runtime conversion is complete for the compatibility wave, not for the full future source-only TypeScript runtime. The distinction matters: contracts first, runtime conversion later, strictness last remains the migration rule.
5. snapshot/runtime store boundary hardening is complete for this wave.

## RuntimeSnapshotStore TypeScript Boundary Hardening Wave

The RuntimeSnapshotStore TypeScript Boundary Hardening wave is now in place:

1. snapshot/runtime store boundary hardening is complete for this wave. The TypeScript contract layer now represents session snapshots, task board snapshots, task-indexed snapshots, projection state, replay proof, and grouped runtime snapshot artifacts.
2. `RuntimeSnapshotStore.js` still remains the source-run authority for current CLI compatibility, but default projection state, default replay proof, projection normalization, and replay-proof merge behavior now delegate through `RuntimeSnapshotStoreRuntime.js`.
3. full source-only .ts runtime loading remains deferred until CLI build/shim strategy is selected. The current path keeps `node ask-core/bin/ask.js` safe while moving behavior behind typed contracts.
4. current snapshot paths and wire shapes remain unchanged. `.ask/runtime/snapshots/*`, `.ask/runtime/projection-state.json`, and `.ask/runtime/replay-proof.json` keep their existing compatibility behavior.
5. task/slice runtime conversion or CLI build/shim strategy is now the next likely implementation area.

## TaskRuntime TypeScript Boundary Hardening Wave

The TaskRuntime TypeScript Boundary Hardening wave is now in place:

1. TaskRuntime boundary hardening is complete for this wave. Current task lifecycle behavior for create, assign, start, complete, reopen, dependency add, status, freshness defaults, and rejected transitions is characterized before deeper runtime migration.
2. `TaskRuntime.js` still remains the source-run authority for current CLI compatibility, but pure task normalization, freshness enrichment, lifecycle payload construction, and successful result construction now delegate through `TaskRuntimeHelpers.js`.
3. `TaskRuntimeHelpers.ts` provides the typed helper boundary for the same pure behavior while source-run runtime files avoid importing `.ts` helpers directly.
4. task invariant typing is covered by a TypeScript companion while `taskInvariants.js` remains the current source-compatible runtime import. Existing validation error codes and transition metadata remain unchanged.
5. SliceCloseRuntime remains deferred because it owns validation, OHDER, auto-commit, rollback, and pre-push behavior. That runtime needs its own governed wave rather than being bundled into TaskRuntime helper hardening.
6. full source-only .ts runtime loading remains deferred until CLI build/shim strategy is selected. The migration rule remains contracts first, runtime conversion later, strictness last.

## TaskBoardProjector TypeScript Boundary Hardening Wave

The TaskBoardProjector TypeScript Boundary Hardening wave is now in place:

1. TaskBoardProjector boundary hardening is complete for this wave. Current task-board projection behavior for taskless events, unknown events, task lifecycle events, assignment, blocking, completion, reopening, acceptance criteria normalization, dependency merge/sort, and refactor approval/rejection projection is characterized.
2. `TaskBoardProjector.js` still remains the source-run authority for current CLI compatibility, but pure task ID normalization, safe object cloning, acceptance criteria normalization, base task construction, task replacement, and dependency merging now delegate through `TaskBoardProjectorHelpers.js`.
3. `TaskBoardProjectorHelpers.ts` provides the typed helper boundary for the same pure behavior while source-run runtime files avoid importing `.ts` helpers directly.
4. RuntimeProjectionEngine.js still runs as source-compatible JavaScript while task-board projection helpers are typed and mirrored. Full projection engine TypeScript conversion remains deferred until source-run CLI compatibility has a selected migration path.
5. Plan Batch Registry Runtime Conversion is the next likely wave because plan-batch contracts already exist, but the read/write runtime path has not yet received the same source-compatible TypeScript boundary treatment.
6. SliceCloseRuntime remains deferred because it owns validation, OHDER, auto-commit, rollback, and pre-push behavior. That runtime should follow after task-board projection and plan-batch registry behavior are stable.
7. The migration rule remains contracts first, runtime conversion later, strictness last.

## Next Recommended Implementation Sequence

1. Plan Batch Registry Runtime Conversion: typed plan-batch contracts already exist, so the next smallest runtime wave should harden plan-batch read/write behavior behind typed helpers and source-compatible JavaScript mirrors.
2. SliceCloseRuntime boundary: defer until plan batch behavior is stable because slice close owns validation, OHDER, auto-commit, rollback, and pre-push behavior.
3. Law-pack and profile runtime conversion: move each runtime behind its existing contract fixture coverage.
4. CLI entrypoint conversion and JavaScript compatibility shim: defer until runtime boundaries are stable unless selected as the explicit build/shim wave.
5. Strictness ratchet: apply stricter TypeScript settings last, first to contracts, then runtime core, then the full package.

## Guardrail

Completed adapter capabilities must not be recreated under new slice IDs. Future plans should reference the completed `ask-adapter-*` slices when discussing `ask-ts-011` or `ask-ts-012`.

ASK ready-plan and slice-close governance remain required for this continuation. Every future implementation plan should be committed as ASK-ready markdown and JSON before handoff, and every implementation slice should close through `ask slice close` after validation.
