# ASK Forge v6 TypeScript Contract Foundation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish the TypeScript contract foundation for ASK Forge v6 as the start of ASK becoming a language-agnostic autonomous software governance runtime.

**Architecture:** Add TypeScript as a contract layer first, not a runtime rewrite. Contracts must model current `.ask` persisted artifacts and CLI outputs before runtime modules import them. Node/JavaScript remains fully supported while ASK Core begins separating language-neutral governance concepts from future adapter-specific behavior.

**Tech Stack:** Node.js ESM, npm, TypeScript, node:test, ASK Core CLI/runtime, existing `.ask` runtime artifacts, existing git hook governance.

---

## Slice 001 - TypeScript Tooling Foundation

Add TypeScript support without changing runtime behavior.

Acceptance criteria:

- TypeScript tooling is installed with npm, not pnpm.
- A permissive TypeScript configuration exists for the current repo shape.
- `npm run typecheck` exists and passes.
- `npm run build` exists and passes.
- `npm test` still passes.
- `node ask-core/bin/ask.js --help` still works.
- No existing runtime JavaScript behavior is changed.

## Slice 002 - Current Runtime Artifact Contracts

Create the first TypeScript contract layer for current persisted ASK runtime shapes.

Acceptance criteria:

- `ask-core/src/contracts` exists and exports shared/current artifact contracts.
- Contracts model current runtime event, sequence, projection, active session, task board, and plan batch shapes.
- Contract fixture tests prove current `.ask` artifact examples match the contracts.
- Contracts compile through `npm run typecheck`.
- No runtime behavior changes.

## Slice 003 - Typed Event Contract Layer

Define current-shape typed runtime event contracts.

Acceptance criteria:

- Runtime event contracts use the current persisted event shape: `seq`, `type`, `ts`, `sessionId`, `taskId`, `actor`, `payload`, and `meta`.
- Known event names emitted by current ASK runtimes are represented by a typed union or safe extensible type.
- High-value event payloads are typed for task, plan handoff, architecture validation, entropy, and OHDER finding events.
- Existing event ledger records remain compatible.
- Event contract tests pass.

## Slice 004 - Typed Task Slice And Plan Batch Contracts

Formalize ASK's plan-to-slice lifecycle types without changing the runtime.

Acceptance criteria:

- Task status and task board contracts match current projected task shapes.
- Plan JSON input contracts match current `schemaVersion: 2` plan artifacts.
- Materialized slice origin contracts include current plan ingest metadata.
- Existing `docs/plans/*.plan.json` files validate against the contract tests.
- `ask plan validate` still works for the v6 foundation plan.

## Slice 005 - Check And Governance Result Contracts

Give validation, hook, and OHDER output stable TypeScript boundaries.

Acceptance criteria:

- Check result contracts cover current pre-commit, commit-msg, and pre-push outputs.
- Governance contracts cover current OHDER validation, architecture score, semantic facts, findings, and OFRR resolution records.
- OFRR remains record-only; no blocking semantics change.
- Contract tests cover representative current outputs.
- Existing governance and pre-push checks still pass.

## Slice 006 - Language Adapter Contract

Define the language-agnostic adapter interface without moving Node behavior yet.

Acceptance criteria:

- `AskLanguageAdapter` and related capability/context/result types compile.
- The adapter contract supports current Node needs: install, format, lint, typecheck, test, build, detection, changed-file test mapping, and architecture inspection.
- Missing optional capabilities can be represented as skipped or unavailable.
- No Python, PHP, .NET, Java, C++, Go, or Rust adapters are implemented yet.
- No runtime behavior changes.

## Slice 007 - Project Profile And Law Pack Contracts

Prepare ASK Forge for language, framework, and governance law composition.

Acceptance criteria:

- Project profile contracts define language/framework/profile/gate relationships.
- Law pack contracts define laws, severities, scope, and default enablement.
- Example IDs may mention Node/JavaScript and Node/TypeScript, but no enforcement behavior changes.
- Contracts compile and are exported from `ask-core/src/contracts`.
- Docs explain these are v6 foundation contracts, not active multi-language adapter implementations.

## Slice 008 - Worker And Queue Contracts

Type orchestration concepts used by governed autonomous development.

Acceptance criteria:

- Worker assignment contracts exist for orchestrator, builder, validator, committer, and projector roles.
- Queue class contracts match the current queue class registry values.
- Contract tests cover accepted and rejected queue class examples.
- Existing plan ingest queue validation behavior is unchanged.

## Slice 009 - Contract Fixture Test Suite

Prove the new contracts match current runtime reality.

Acceptance criteria:

- Fixture samples exist for event ledger records, task board entries, plan batches, hook results, OHDER findings, and OFRR resolutions.
- Tests verify fixtures with runtime validation helpers or typed fixture imports.
- `npm run typecheck` catches contract compile errors.
- `npm test` passes.
- No current `.ask` artifact field names are renamed.

## Slice 010 - Documentation And v6 Framing

Document the ASK Forge v6 language-agnostic foundation direction.

Acceptance criteria:

- README explains the v6 direction: TypeScript contracts as the first step toward language-agnostic ASK Forge.
- Operations docs distinguish v5.1 OHDER semantic autonomy from v6 contract foundation.
- Docs state Node/JavaScript remains the first supported adapter target.
- Docs do not claim non-Node adapters exist yet.
- A release note draft section for v6.0.0 exists or is updated.
