# ASK Plan Mode Handoff Enforcement Plan

## Purpose

Prevent implementation from starting after a written Codex/Superpowers plan until that plan has been handed to ASK, converted into governed slices, and an active ASK slice has been started.

This closes the governance gap where a plan can be written in Plan Mode, the operator can choose "Implement the plan", and development begins without markdown and JSON plan artifacts entering ASK ingestion.

## Target Outcome

ASK becomes the mandatory bridge between planning and implementation:

1. Codex/Superpowers writes or receives a plan.
2. The plan is saved as a markdown source artifact.
3. A structured JSON plan artifact is attached to an ASK workflow run.
4. `ask plan validate` confirms the artifact is ingestible.
5. `ask plan ingest` materializes governed ASK slices.
6. `ask next` presents the next slice.
7. Implementation can only proceed when an ASK slice is active.
8. Slice close validates, records, and commits the completed slice with provenance.

## Scope

This plan adds guardrails and operator-facing commands for Plan Mode handoff enforcement. It does not attempt to replace Codex planning or Superpowers writing-plans. ASK governs the lifecycle boundary after a plan exists.

## Slice 001 - Plan Mode Handoff Runtime

Create a runtime and CLI command that takes a markdown plan plus structured JSON plan, records both as governed artifacts, attaches the JSON artifact to a workflow run, validates it, and ingests it through the existing PlanIngestRuntime.

Acceptance criteria:

- `ask plan-mode handoff` exists.
- The command accepts title, source markdown path, JSON plan path, task id, run id, and workflow metadata.
- The runtime records a durable handoff state file under `.ask/runtime`.
- The runtime emits explicit events for handoff creation, validation, and ingestion.
- The command returns the created ASK task ids and next task when ingestion succeeds.

## Slice 002 - Implementation Preflight Runtime

Add an implementation preflight that refuses development when a plan handoff is required but no active ASK slice is present.

Acceptance criteria:

- `ask implementation preflight` exists.
- The preflight can detect missing plan handoff state.
- The preflight can detect no active ASK task.
- The preflight reports the exact recovery command: `ask plan-mode handoff ...` or `ask next` / `ask task start <taskId>`.
- The preflight supports a documented advisory mode for non-Plan-Mode maintenance.

## Slice 003 - Pre-Commit Implementation Contract Gate

Extend git hook enforcement so commits that look like implementation work cannot bypass ASK slice governance.

Acceptance criteria:

- The pre-commit adapter invokes the implementation preflight or equivalent runtime check.
- The gate blocks implementation commits with no active slice or no slice close provenance.
- Documentation explains how to recover from the block.
- Existing hook behavior remains intact.

## Slice 004 - Commit Message ASK-Slice Provenance

Add commit-message enforcement so governed implementation commits carry explicit ASK slice provenance.

Acceptance criteria:

- A commit message hook adapter exists and is wired by ASK hook installation.
- Slice-close commits include an `ASK-Slice: <taskId>` footer.
- Non-governed implementation commits are blocked unless explicitly classified as docs/tooling maintenance.
- Tests cover valid and invalid commit messages.

## Slice 005 - ASK Next Plan Mode Awareness

Teach `ask next` to surface pending plan handoff and active slice guidance.

Acceptance criteria:

- If a plan handoff is pending validation/ingestion, `ask next` reports the handoff state.
- If a plan was ingested, `ask next` prioritizes the next open generated slice.
- If implementation is attempted before `task start`, `ask next` explains the required command.

## Slice 006 - Governance Bypass Finding

Make governance bypass attempts visible as OHDER/ASK findings instead of silent operator mistakes.

Acceptance criteria:

- Missing handoff, missing active slice, and invalid commit provenance create explainable findings.
- Findings include evidence, severity, remediation, and artifact references.
- Findings can be listed through existing governance/finding commands.

## Slice 007 - Operator Documentation

Document the Plan Mode to ASK handoff lifecycle and the expected command flow.

Acceptance criteria:

- README or operations documentation describes the handoff loop.
- Examples show markdown plan, JSON plan, ingest, `ask next`, task start, implementation, validation, and slice close.
- The docs clarify ASK, Codex, and Superpowers responsibilities.

## Slice 008 - End-to-End Governance Contract

Add an end-to-end test that proves a plan can be handed to ASK, ingested into slices, started, validated, and closed with provenance enforcement.

Acceptance criteria:

- The test exercises the operator flow from plan artifact to governed slice start.
- The test verifies enforcement blocks bypass when the active slice/provenance is missing.
- The test verifies slice-close commits carry ASK provenance.
