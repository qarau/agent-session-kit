# Automatic Plan Handoff Artifact Generation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make future "Implement the plan" flows produce ASK-ingestible plan artifacts and enter ASK governance before implementation can begin.

**Architecture:** Add a preparation runtime that turns a markdown plan into canonical ASK markdown and JSON artifacts, then add an implementation begin runtime that prepares, hands off, ingests, and returns the next governed slice command. Existing preflight and hook enforcement remain the hard boundary for implementation work.

**Tech Stack:** Node.js ESM, ASK Core CLI/runtime, existing plan ingest/handoff runtimes, node:test contract tests.

---

## Slice 001 - Plan Mode Prepare Runtime

Create `ask plan-mode prepare` to convert a markdown plan into canonical markdown and ASK JSON artifacts.

Acceptance criteria:

- `ask plan-mode prepare --title <title> --source <md>` exists.
- The runtime writes a canonical markdown artifact under `docs/plans/`.
- The runtime writes a matching ASK plan JSON artifact under `docs/plans/`.
- The generated JSON uses schema version 2 and validates through existing plan validation.
- The command returns artifact paths and the exact next `ask plan-mode handoff ...` command.

## Slice 002 - Implementation Begin Runtime

Create `ask implementation begin` to prepare artifacts, hand them to ASK, ingest slices, and report the next governed task command.

Acceptance criteria:

- `ask implementation begin --title <title> --plan <md>` exists.
- The runtime calls the prepare behavior and then the existing plan-mode handoff behavior.
- The runtime returns created task ids, the selected next task, and `ask task start <taskId>`.
- Existing `ask implementation preflight` behavior remains intact for active-slice checks.

## Slice 003 - Recovery Adapter And Documentation

Make the new implementation boundary visible to operators and automation.

Acceptance criteria:

- Missing-handoff preflight recovery points to `ask implementation begin --plan <md> --title <title>`.
- A session adapter script exists for Codex/Superpowers workflows to invoke implementation begin.
- README or operations docs explain that "Implement the plan" must call implementation begin before editing.
- The docs keep the ASK/Codex/Superpowers responsibility split clear.

## Slice 004 - End-To-End Begin Governance Contract

Add an end-to-end contract proving a raw plan cannot become implementation until `ask implementation begin` creates ASK artifacts and slices.

Acceptance criteria:

- The test starts with a raw markdown plan and no handoff.
- Preflight blocks implementation and reports the implementation begin recovery command.
- `ask implementation begin` creates markdown and JSON artifacts, ingests slices, and returns `ask task start <taskId>`.
- After task start, implementation preflight passes and slice close commits with `ASK-Slice` provenance.
