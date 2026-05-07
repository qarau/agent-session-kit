# Policy Reference

## Runtime Policy Files

- `.ask/policy/runtime-policy.yaml`: primary policy surface
- `.ask/policy/ohder-law-pack.json`: architect law pack and exemptions

Runtime policy schema is versioned (`schema_version: 2`) and supports migration from legacy v1 aliases.

Schema tooling:

- `ask policy schema`
- `ask policy migrate --dry-run`
- `ask policy migrate`

## Critical Runtime Sections

## `autonomy`

- `enabled`: enables/disables autonomous continuation
- `default_mode`: default run mode (`once`/looping)
- `max_slices_per_run`: loop cap
- `require_clean_worktree`: blocks autonomous intent when dirty

## `architect`

- `enabled`
- `block_on_violation`
- `max_entropy_delta`
- `max_coupling_delta`
- `require_replayability`

These controls shape architect outcomes and law-pack threshold values.

## `flow`

- `enabled`
- `block_on_hard_flow_violation`
- `block_on_protected_flow_violation`
- `require_flow_map_for_hard_flow`
- `behavior_replay_enabled`
- `min_behavior_replay_confidence`
- `min_protected_replay_confidence`
- `min_hard_flow_replay_confidence`

Flow lifecycle/promotion controls:

- `require_promotion_reason`
- `promotion_reason_min_length`
- `require_approval_for_protected`
- `require_approval_ticket_for_protected`
- `require_approval_for_hard_flow`
- `require_approval_ticket_for_hard_flow`

## `design`

- `enabled`
- `discovery_enabled`
- `warn_only`
- `block_on_protected_violation`
- `require_promotion_reason`
- `promotion_reason_min_length`
- `require_approval_for_standardized`
- `require_approval_ticket_for_standardized`
- `require_approval_for_protected`
- `require_approval_ticket_for_protected`

Design runtime uses changed-files + visual-regression map evidence to emit design drift warnings and metrics.

## `refactor_governance`

- `enabled`
- `trigger_on_architect_failed`
- `trigger_on_flow_replay_failed`
- `auto_retry_on_trigger`
- `block_on_revalidation_failure`

These keys decide whether governance triggers automated retry slices or hard blocks.

## `metrics`

- `drift_window_size`: rolling history window for drift analytics

## `governance_contract`

- `policy_schema_version`
- `enforce_architect_runtime`
- `enforce_flow_runtime`
- `enforce_projection_runtime`
- `strict_cross_runtime_validation`

This section defines the cross-runtime governance contract shared by ASK, Architect, and Flow runtimes.

## `slice_close`

- `enabled`
- `run_pre_push_check`
- `retry_commit_once`
- `full_suite_required_lanes`
- `full_suite_command`
- `full_suite_args`
- `commit_subject_template`

This section governs `ask slice close <taskId>` auto-close behavior (auto verification, auto completion, commit creation, and post-commit push gate validation).

## `slice_commit`

- `enabled`
- `footer_key`
- `exempt_footer_key`
- `allowed_exemptions`
- `exempt_allowed_path_prefixes`
- `exempt_allowed_exact_files`

This section governs pre-push commit traceability: each outgoing commit must carry a single slice footer (`ASK-Slice: <taskId>`) or an explicit release/meta exemption footer.

## OHDER Law Pack

`ohder-law-pack.json` contains:

- `laws[]`: rule set (`id`, `metric`, `operator`, `value`, `severity`, optional `lawClass`, optional `outcome`)
- `defaultOutcomes`: severity-to-outcome map
- `exemptions[]`: controlled overrides

Law classes:

- `lawClass: "hard"` defaults to `block` when violated.
- `lawClass: "soft"` defaults to `warn` when violated.
- explicit `outcome` still overrides the law-class default.

Current exemption CLI:

- `ask architect exempt add --law-id <id> --reason <text> --approved-by <id> [--operation <name>] [--session-id <id>] [--expires-at <iso>]`
- `ask architect exempt list`
