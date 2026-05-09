# TypeScript Governance Contract Gap Audit

This audit maps the next TypeScript migration area from `docs/operations/typescript-migration-status.md` against the current ASK Forge runtime outputs.

## Scope

The audit covers:

- `ask-ts-013`: governance findings typing.
- `ask-ts-014`: OFRR resolutions typing.
- `ask-ts-015`: governance explain output typing.

## Findings

| Area | Current Runtime Output | Current TypeScript Coverage | Gap Category | Required Follow-Up |
| --- | --- | --- | --- | --- |
| `ask-ts-013` OHDER findings | `.ask/runtime/findings/ohder-findings.json`, `ask architect finding list`, architect runtime findings | `AskOhderFinding`, `AskOhderSemanticFact`, `AskOhderLawViolation` | missing runtime helper typing | Add a TypeScript-facing boundary helper so runtime finding records can be validated without changing persisted shape. |
| `ask-ts-014` OFRR resolutions | `ask architect finding resolve`, `OhderFindingResolved` events, finding `resolution` records | `AskOhderFindingResolution` | missing runtime helper typing | Add a TypeScript-facing boundary helper for resolution records while preserving OFRR as record-only. |
| `ask-ts-015` governance explain | `ask governance explain` payload with `explanation` object and OHDER decision details | Partial governance decision typing only | contract-only | Add a representative contract fixture for explain payloads before deeper runtime typing. |

## Drift Assessment

No runtime-shape drift was found for current OHDER finding or OFRR resolution fixtures. The existing JSON fixtures map to the field names in `ask-core/src/contracts/governance.ts`.

`ask governance explain` has tested runtime shape, but it lacks a dedicated exported TypeScript contract and representative JSON fixture. That is a contract-only gap until the CLI output diverges from its current tested shape.

## OFRR Behavior Guardrail

OFRR remains record-only in this migration area. Resolution records make false positives, justified risks, exemptions, and analyzer/law tuning requests visible and auditable, but they must not suppress OHDER blocking by themselves.

The next implementation slices must preserve no blocking behavior change.
