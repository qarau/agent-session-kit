# Codex Context Budget Integration Design

Date: 2026-03-12  
Branch: `ask-hard-cutover`

## Problem

Codex users can hit context pressure mid-task. This can trigger compaction/re-hydration at awkward points and increase apparent hangs or interrupted progress.

## Goal

Add optional ASK runtime support for Codex Responses API context budgeting so teams can:

1. inspect context budget state,
2. proactively compact when threshold is crossed,
3. keep deterministic local state for resume workflows.

## Scope

In scope:

1. Optional policy-driven Codex budget manager.
2. ASK CLI surface:
   - `ask codex context status`
   - `ask codex context compact`
   - `ask codex context ensure`
3. Persist local context state:
   - `.ask/runtime/context-session.json`
4. Integrate `session doctor` output with Codex context summary.

Out of scope:

1. Hook hard-fail behavior on network/API errors.
2. Automatic compaction inside pre-commit/pre-push hook execution path.
3. Non-Codex provider support.

## Policy Model

Extend `.ask/policy/runtime-policy.yaml` with:

```yaml
codex_context:
  enabled: false
  min_remaining_ratio: 0.10
  reserve_output_tokens: 12000
  strategy: explicit
```

Notes:

1. `enabled=false` by default keeps existing behavior unchanged.
2. `strategy` supports:
   - `explicit`: manager calls compact endpoint when needed.
   - `auto`: manager reports threshold status and guidance while deferring compaction behavior to server-side threshold strategy.

## Architecture

### 1) CodexContextBudgetManager

Add `ask-core/src/integrations/codex/ContextBudgetManager.js`:

Responsibilities:

1. Read policy + runtime context session state.
2. Query token usage via Responses API input-token counting endpoint.
3. Compute remaining ratio using configured context window and reserve tokens.
4. Execute compaction when `ensure` and threshold crossed (`explicit` strategy).
5. Persist deterministic state in `.ask/runtime/context-session.json`.
6. Degrade gracefully on missing key/network/API errors (advisory output).

### 2) Runtime State

Persist:

```json
{
  "provider": "openai-responses",
  "enabled": true,
  "strategy": "explicit",
  "minRemainingRatio": 0.1,
  "reserveOutputTokens": 12000,
  "lastCountAt": "2026-03-12T12:00:00.000Z",
  "inputTokens": 12345,
  "maxContextTokens": 400000,
  "remainingTokens": 387655,
  "remainingRatio": 0.9691,
  "lastCompactedAt": "",
  "lastCompactionResponseId": "",
  "status": "ok",
  "message": ""
}
```

### 3) CLI Surface

Add new command family:

1. `ask codex context status`
2. `ask codex context compact`
3. `ask codex context ensure`

All commands emit deterministic JSON and never mutate hook outcomes.

### 4) Session Doctor Integration

`ask session doctor` appends Codex context summary when state exists:

1. `codexContext.enabled`
2. `codexContext.status`
3. `codexContext.remainingRatio`
4. `codexContext.suggestedAction`

## Failure Semantics

1. Missing API key or API/network failure:
   - `ok: false`, advisory message, no hard throw for normal status/ensure command.
2. Explicit compact failure:
   - deterministic JSON error payload, exit code 1 only for direct `compact` command.
3. Disabled policy:
   - deterministic `disabled` status, no API calls.

## Testing

1. Add contract tests with mocked `fetch`:
   - status with disabled policy
   - ensure below threshold triggers compact in explicit strategy
   - ensure above threshold skips compact
   - API failure degrades gracefully
2. Add CLI contract tests for `ask codex context *`.
3. Update session doctor contract tests for codex summary presence.

## Acceptance Criteria

1. Codex context commands exist and return deterministic JSON.
2. Context budget state persists to `.ask/runtime/context-session.json`.
3. Threshold logic supports `min_remaining_ratio=0.10`.
4. No regression in existing ASK runtime/hook tests.
