# ASK Plan Ingestion Efficiency Guard Plan

## Summary
Fix the workflow gap that let an approved multi-slice plan degrade into one generic ASK slice. The runtime should ingest the first approved plan directly, recognize common multi-slice markdown formats, and fail fast when slice extraction is ambiguous instead of silently creating a wasteful fallback slice.

## Key Changes
- Update `PlanModePrepareRuntime` slice extraction to support both ASK-native headings and conversational plan headings:
  - `## Slice 1: Name`
  - `## Slice 001 - Name`
  - `## Slices` followed by child headings like `### Node Adapter Wrapper`
- Add extraction diagnostics to `ask plan-mode prepare` and `ask implementation begin`:
  - `sliceCount`
  - `sliceTitles`
  - `sourceFormat`
  - `warnings`
- Add fail-fast behavior:
  - If markdown appears to contain multiple slices but extraction would produce one generic fallback slice, return `ok: false`.
  - Use code `plan-slice-extraction-ambiguous`.
  - Include a clear message explaining the accepted heading formats.
- Preserve valid single-slice behavior:
  - A genuinely one-slice or unsliced plan can still become one fallback slice.
  - Only multi-slice-looking plans should be blocked.
- Update operator docs to lock the workflow:
  - Approved Plan Mode output is the source of truth.
  - Do not rewrite or regenerate the approved plan before ASK ingestion.
  - `Implement the plan` should mean: prepare exact approved plan, ready-plan commit, handoff, start next slice.

## Implementation Slices
### Slice 1: Broaden Slice Extraction
Modify `ask-core/src/core/PlanModePrepareRuntime.js`.

Acceptance criteria:
- `## Slice 001 - Name` still works.
- `## Slice 1: Name` still works.
- `## Slices` plus `### Name` sections extracts each child heading as a slice.
- Description and acceptance criteria are preserved per child section.
- Dependencies still chain in extracted order.

### Slice 2: Add Ambiguity Guard
Modify `PlanModePrepareRuntime` and related CLI tests.

Acceptance criteria:
- A markdown plan with `## Slices` and multiple child headings never becomes one generic slice.
- Ambiguous extraction fails with `plan-slice-extraction-ambiguous`.
- Error output tells the user to use `## Slice N: Title` or `## Slices` plus child headings.
- `ask implementation begin` surfaces the prepare failure and does not commit ready-plan artifacts or ingest tasks.

### Slice 3: Add Regression Tests
Extend:
- `ask-core/tests/planModePrepareRuntime.contract.test.mjs`
- `ask-core/tests/implementationBeginRuntime.contract.test.mjs`

Test scenarios:
- Conversational multi-slice plan with `## Slices` and `###` child sections creates multiple slices.
- Current ASK-native slice heading format still creates multiple slices.
- Ambiguous multi-slice-looking markdown fails before ready-plan commit.
- Re-running implementation begin remains idempotent after a successful prepare/handoff.

### Slice 4: Document The Streamlined Flow
Update the relevant plan-mode / implementation-governance docs.

Acceptance criteria:
- Docs explain that the approved plan is the canonical source.
- Docs warn that regenerating the plan after user approval is YAGNI unless the user asks for revision.
- Docs show the streamlined sequence:
  - final plan
  - `ask implementation begin`
  - ready-plan commit
  - handoff
  - governed slice execution
- Docs include examples of accepted slice heading formats.

## Test Plan
- Run targeted tests:
  - `node --test --test-concurrency=1 ask-core/tests/planModePrepareRuntime.contract.test.mjs`
  - `node --test --test-concurrency=1 ask-core/tests/implementationBeginRuntime.contract.test.mjs`
- Run full validation:
  - `npm run typecheck`
  - `npm run build`
  - `npm test`
  - `node ask-core/bin/ask.js pre-push-check`
- Close each implementation slice through ASK with `ask slice close <taskId>` so each passing slice commits independently.

## Assumptions
- We should fix the runtime, not rely on agent memory.
- ASK should fail closed when a plan looks multi-slice but cannot be safely parsed.
- The existing one-slice fallback remains useful for genuinely small plans.
- This plan should be ingested as governed ASK slices before implementation.
