# ASK Ready-Plan Commit Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `ask ready-plan commit` so prepared markdown and JSON plan artifacts receive their own provenance commit before ASK handoff creates governed slices.

**Architecture:** Introduce a ready-plan commit runtime and CLI that commits only prepared plan artifacts with `ASK-Plan` footers. Extend commit governance to recognize plan-provenance commits, then integrate the runtime into `ask implementation begin` before handoff.

**Tech Stack:** Node.js ESM, ASK Core CLI/runtime, git subprocesses, existing commit-msg/pre-push governance, node:test contract tests.

---

## Slice 001 - Ready-Plan Commit Runtime

Create a runtime and CLI command that commits only prepared ASK plan artifacts.

Acceptance criteria:

- `ask ready-plan commit --title <title> --source <md> --plan-json <json>` exists.
- The runtime validates both files exist and are under `docs/plans/`.
- The runtime stages only the markdown and JSON plan artifacts.
- The runtime creates a commit with `ASK-Plan`, `ASK-Plan-Markdown`, and `ASK-Plan-JSON` footers.
- If the plan artifacts are already committed and the worktree is clean, the runtime returns a non-mutating success result.

## Slice 002 - ASK-Plan Commit Governance

Extend commit-message and pre-push governance so plan commits are first-class provenance, not generic meta exemptions.

Acceptance criteria:

- `commit-msg-check` accepts exactly one `ASK-Plan: <planId>` footer.
- Commit messages cannot mix `ASK-Plan`, `ASK-Slice`, or `ASK-Exempt`.
- Pre-push accepts `ASK-Plan` commits only when changed files are plan artifacts under `docs/plans/`.
- Pre-push rejects `ASK-Plan` commits that include implementation files.

## Slice 003 - Implementation Begin Integration

Teach `ask implementation begin` to create the ready-plan commit after prepare and before handoff.

Acceptance criteria:

- `ask implementation begin` calls ready-plan commit after prepare succeeds.
- The begin payload includes ready-plan commit metadata.
- Handoff still ingests slices and returns `ask task start <taskId>`.
- If the ready-plan commit already exists, implementation begin continues without duplicating the commit.

## Slice 004 - Docs And E2E History Contract

Document and prove the complete git history shape.

Acceptance criteria:

- README or operations docs show `prepare -> ready-plan commit -> handoff -> slice close`.
- The docs show the intended git log shape with a plan commit before slice commits.
- E2E test starts from a raw markdown plan and runs `ask implementation begin`.
- E2E test verifies git log has a ready-plan commit before the slice-close commit.
- E2E test verifies the slice-close commit still carries `ASK-Slice`.
