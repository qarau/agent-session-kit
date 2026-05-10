# ASK Forge TypeScript Migration Status

This document reconciles `docs/ASK/ask_forge_type_script_migration_implementation_spec_v_1_red.md` against the current ASK Forge repository state.

## Current Position

`ask-ts-001 through ask-ts-010` are completed by the v6 TypeScript contract foundation. Those slices established TypeScript tooling, current artifact contracts, event contracts, task/plan contracts, check/governance contracts, adapter contracts, profile/law-pack contracts, worker/queue contracts, JSON contract fixtures, and v6 documentation framing.

The adapter activation work from the original spec was completed under a separate governed plan:

- `ask-ts-011` is completed by `ask-adapter-002` and `ask-adapter-003`.
- `ask-ts-012` is completed by `ask-adapter-004`.

do not duplicate the completed adapter work. The next true unfinished area is governance/OFRR runtime typing, not adapter detection duplication.

The adapter wrapper, project detection, and adapter resolution are already complete. They should be referenced as completed capabilities, not regenerated under new TypeScript migration slice IDs.

## Reconciliation Map

| Spec Slice | Current Status | Evidence |
| --- | --- | --- |
| `ask-ts-001` TypeScript tooling | Completed | `package.json`, `tsconfig.json`, `npm run typecheck`, `npm run build` |
| `ask-ts-002` Core contract directory | Completed | `ask-core/src/contracts/*` |
| `ask-ts-003` Typed runtime events | Completed foundation | `ask-core/src/contracts/events.ts`, `runtimeEventContracts.contract.test.mjs` |
| `ask-ts-004` Event ledger append/read conversion | Completed boundary foundation, runtime conversion remaining | Event contracts, EventLedger boundary contracts, and runtime guard tests exist; ledger implementation remains JavaScript |
| `ask-ts-005` Projection cursor state conversion | Completed boundary foundation, full projection engine conversion remaining | Projection cursor contracts, replay proof contracts, runtime artifact fixtures, and projection-state compatibility tests exist; projection engine implementation remains JavaScript |
| `ask-ts-006` Task and slice model conversion | Completed foundation, runtime conversion remaining | `tasks.ts` and task contract tests exist |
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

## Next Implementation Area

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

The EventLedger implementation still remains JavaScript-first. The current work hardens the boundary before runtime conversion.

governance runtime decomposition is complete for this wave. Deeper governance runtime conversion remains deferred until source-run CLI compatibility has a selected migration path.

projection cursor runtime conversion was the next deferred step after the ledger boundary work and is now complete for the boundary/compatibility wave. Projection cursor correctness is now covered through stable event ordering assumptions, replay proof contracts, cursor state contracts, and projection-state normalization tests.

## Projection Cursor TypeScript Runtime Boundary Wave

The Projection Cursor TypeScript Runtime Boundary wave is now in place:

1. projection cursor boundary/conversion is complete for this wave. The TypeScript contract layer now represents projection cursor state, replay proof, sequence integrity, projection run summaries, and representative runtime artifacts.
2. projection-state compatibility hardening is complete. `RuntimeSnapshotStore.readProjectionState()` and `writeProjectionState()` normalize missing or invalid cursor fields while preserving existing artifact paths and wire shape.
3. full projection engine TypeScript conversion remains deferred. `RuntimeProjectionEngine.js` still runs as source-compatible JavaScript while its cursor and replay artifact boundary is typed and tested.
4. EventLedger runtime conversion or snapshot/runtime store boundary hardening is the next recommended area. EventLedger conversion should preserve the existing append/read wire shape, while snapshot/runtime store hardening should reduce broad runtime-file responsibility before deeper TypeScript conversion.

## Next Recommended Implementation Sequence

1. EventLedger runtime conversion or snapshot/runtime store boundary hardening: choose the smallest next wave based on whether the priority is event append/read source conversion or reducing broad snapshot-store responsibility.
2. event ledger runtime conversion: convert append/read implementation to TypeScript after projection assumptions are explicitly covered, if not selected first.
3. governance runtime conversion: convert governance helper/report builder logic to TypeScript only after source-run CLI compatibility has a selected migration path.
4. Task, plan, law-pack, and profile runtime conversion: move each runtime behind its existing contract fixture coverage.
5. CLI entrypoint conversion and JavaScript compatibility shim: defer until runtime boundaries are stable.
6. Strictness ratchet: apply stricter TypeScript settings last, first to contracts, then runtime core, then the full package.

## Guardrail

Completed adapter capabilities must not be recreated under new slice IDs. Future plans should reference the completed `ask-adapter-*` slices when discussing `ask-ts-011` or `ask-ts-012`.

ASK ready-plan and slice-close governance remain required for this continuation. Every future implementation plan should be committed as ASK-ready markdown and JSON before handoff, and every implementation slice should close through `ask slice close` after validation.
