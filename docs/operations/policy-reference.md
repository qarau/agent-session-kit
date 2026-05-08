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

## `ohder`

- `mode`: `fast`, `strict`, or `refactor`

Mode behavior:

- `fast`: hard laws still block through the law pack, but analyzer findings remain advisory unless already mapped to an active law.
- `strict`: hard analyzer findings can become blocking architect findings. The first strict checks cover projection authority violations, layer isolation import risk, and high durability risk.
- `refactor`: marks the runtime as refactor-governed for follow-on refactor outcome gates. Refactor-specific enforcement is expanded by the refactor outcome runtime.

Architect status includes `ohderMode` so operators can see which mode produced the current decision.

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

## `refactor_materialization`

This section controls how OHDER refactor recommendations become governed ASK tasks.

Defaults when absent:

- `auto_materialize_high_confidence`: `false`
- `require_approval_for_medium_confidence`: `true`
- `low_confidence_mode`: `suggest-only`

Behavior:

- Low-confidence recommendations are suggestions only.
- Medium-confidence recommendations create approval-required tasks.
- High-confidence recommendations can be created explicitly with `ask refactor create`.
- Automatic high-confidence materialization requires `auto_materialize_high_confidence: true` and is surfaced by `ask next` as `ask refactor create --auto`.
- Target discovery reads recent slice commits and metrics history. Optional `ohder_refactor.target_commit_window` and `ohder_refactor.target_history_window` values can bound how much history is considered.
- If no uncompleted target is discoverable, ASK suppresses the generic recommendation and routes `ask next` to governance validation.
## `metrics`

- `drift_window_size`: rolling history window for drift analytics

## `ohder_entropy`

Entropy runtime currently uses deterministic defaults when this section is absent:

- `minimum_architecture_score`: defaults to `70`; lower scores create high `refactorPressure`
- `warning_score_drop`: defaults to `5`; score drops at or below this delta create medium `refactorPressure`

Slice-close entropy capture writes `entropyScore`, `architectureScoreDelta`, `refactorPressure`, coupling/replayability trends, and source `slice-close` into metrics history. `ask next` uses this entropy summary when no task is active or ready.

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

Slice close also runs OHDER architect governance before auto verification, task completion, and commit creation. A blocking OHDER result returns `slice-close-ohder-blocked`, leaves the task `in-progress`, and creates no commit.

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

Default hard-law categories:

- `ProjectionAuthority`: `projection_authority == valid`
- `SSoTIntegrity`: `ssot_integrity == valid`
- `Replayability`: `replayability_risk != high`
- `SecurityBoundary`: `security_boundary == valid`
- `LayerIsolation`: `layer_isolation == valid`
- `EventOnlySync`: `event_only_sync == valid`
- `DurabilityIntegrity`: `durability_integrity == valid`

Hard laws are architectural safety boundaries and block unless an active exemption applies. Soft laws are quality and survivability signals such as SRP drift, duplication, weak observability, testability issues, speculative abstraction, replaceability leakage, and complexity growth.

Architect status includes `ohderFacts`, the normalized fact map evaluated by the law pack. Some facts are currently analyzer-derived (`projection_authority`, `layer_isolation`, `durability_integrity`, replayability, entropy, coupling, validation), while future slices expand deeper security, SSoT, and event-only synchronization analyzers.

Architect status includes `architectureScore`, which reports `overallScore`, `grade`, weighted categories, and weights. Use it for trend visibility and refactor prioritization; do not use it to bypass hard-law blocks.

Current exemption CLI:

- `ask architect exempt add --law-id <id> --reason <text> --approved-by <id> [--operation <name>] [--session-id <id>] [--expires-at <iso>]`
- `ask architect exempt list`

