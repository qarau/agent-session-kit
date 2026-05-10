# ASK Forge README Advantage Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the v6 README explain the full ASK Forge advantage through its active runtimes, not only through historical release notes.

**Architecture:** This is a documentation and contract-test slice. The README should front-load a current product narrative that connects ASK Forge's plan, slice, OHDER, flow, design, coordination, delivery, Codex, event ledger, projection, and TypeScript contract runtimes into one coherent advantage story.

**Tech Stack:** Markdown documentation, Node test runner documentation contract tests, ASK governed slice close.

---

## Summary

The current README has accurate release sections, but the top-level value proposition feels dated because the runtime advantages are scattered across v5.0, v5.1, v6.0, and architecture sections. A new developer should quickly understand that ASK Forge is an autonomous development governance platform composed of multiple cooperating runtimes.

## Slice 001 - README Advantage Runtime Map

Update the README advantage narrative and contract tests so ASK Forge's current value is clear before the historical release sections.

Acceptance criteria:

- README contains a current `## ASK Forge Advantage` section near the top.
- The section explains ASK Forge as a governed autonomous software-development platform, not only a hook/check tool.
- The section explicitly maps the active runtime advantages: plan ingestion, slice close, OHDER architecture governance, OHDER semantic autonomy, finding resolution, flow governance, design governance, coordination/runtime routing, delivery governance, Codex controls, event ledger, projection/snapshot continuity, and TypeScript contract foundation.
- README contains a concise `What the runtimes give you` subsection with developer-facing outcomes.
- Historical v5.0, v5.1, and v6.0 sections remain, but they read as evolution history after the current advantage story.
- Documentation contract tests assert the runtime advantage map so the README cannot regress to a narrow dated summary.

## Validation

Targeted validation:

- `node --test ask-core/tests/v6Documentation.contract.test.mjs ask-core/tests/implementationBoundaryDocs.contract.test.mjs`

Final validation:

- `npm test`
- `npm run typecheck`
- `npm run build`
- `node ask-core/bin/ask.js pre-push-check`
