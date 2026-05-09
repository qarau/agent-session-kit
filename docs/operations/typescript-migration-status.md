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
| `ask-ts-004` Event ledger append/read conversion | Remaining runtime migration | Event contracts exist; ledger implementation remains JavaScript |
| `ask-ts-005` Projection cursor state conversion | Remaining runtime migration | Current artifact contracts exist; projection implementation remains JavaScript |
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

## Next Recommended Implementation Sequence

1. governance runtime decomposition: split `ask-core/src/cli/commands/governance.js` and large governance contract fixtures into smaller modules before adding more behavior.
2. event ledger runtime conversion: convert append/read boundaries to TypeScript after the current event contracts have stayed stable.
3. projection cursor runtime conversion: type the projection cursor and replay state after event ledger conversion lands.
4. Task, plan, law-pack, and profile runtime conversion: move each runtime behind its existing contract fixture coverage.
5. CLI entrypoint conversion and JavaScript compatibility shim: defer until runtime boundaries are stable.
6. Strictness ratchet: apply stricter TypeScript settings last, first to contracts, then runtime core, then the full package.

## Guardrail

Completed adapter capabilities must not be recreated under new slice IDs. Future plans should reference the completed `ask-adapter-*` slices when discussing `ask-ts-011` or `ask-ts-012`.

ASK ready-plan and slice-close governance remain required for this continuation. Every future implementation plan should be committed as ASK-ready markdown and JSON before handoff, and every implementation slice should close through `ask slice close` after validation.
