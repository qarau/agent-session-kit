export const defaultPolicyYaml = `schema_version: 2
version: 2

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: true
  require_tests_before_commit: true

workflow_provider:
  superpowers_enabled: true
  superpowers_version: 0.3.0
  superpowers_approved_versions: 0.3.0
  superpowers_allowed_skills: writing-plans,systematic-debugging,executing-plans,verification-before-completion,finishing-a-development-branch
  superpowers_fallback_skill: executing-plans
  superpowers_incompatible_versions:

codex_context:
  enabled: false
  min_remaining_ratio: 0.10
  reserve_output_tokens: 12000
  max_context_tokens: 400000
  strategy: explicit

codex_runtime:
  governed_launch_default: true
  allow_fail_open_launch: false
  require_governed_launch_evidence_for_change_gates: true
  require_governed_checkpoint_for_change_gates: true
  forbid_direct_launch_exception_for_change_gates: true
  require_fail_open_reason: true
  fail_open_reason_min_length: 10
  require_fail_open_approval: true
  require_fail_open_approval_ticket: true
  allow_direct_launch_exception: false
  require_direct_launch_reason: true
  direct_launch_reason_min_length: 10
  require_direct_launch_approval: true
  require_direct_launch_approval_ticket: true

autonomy:
  enabled: true
  default_mode: once
  max_slices_per_run: 1
  allow_until_complete: false
  require_clean_worktree: true

retry:
  max_attempts_per_slice: 2
  max_same_failure_repeats: 2
  max_total_failures_per_session: 5

validation:
  require_acceptance_criteria: true
  require_test_evidence: true
  allow_inconclusive_pass: false

architect:
  enabled: true
  block_on_violation: true
  max_entropy_delta: 3
  max_coupling_delta: 2
  require_replayability: true

refactor_governance:
  enabled: true
  trigger_on_architect_failed: true
  trigger_on_flow_replay_failed: true
  auto_retry_on_trigger: true
  block_on_revalidation_failure: false

flow:
  enabled: true
  discovery_enabled: true
  block_on_hard_flow_violation: true
  block_on_protected_flow_violation: false
  require_flow_map_for_hard_flow: false
  behavior_replay_enabled: true
  min_behavior_replay_confidence: 0.65
  min_protected_replay_confidence: 0.75
  min_hard_flow_replay_confidence: 0.85
  require_promotion_reason: true
  promotion_reason_min_length: 10
  require_approval_for_protected: true
  require_approval_ticket_for_protected: false
  require_approval_for_hard_flow: true
  require_approval_ticket_for_hard_flow: true

design:
  enabled: true
  discovery_enabled: true
  warn_only: true
  block_on_protected_violation: false
  require_promotion_reason: true
  promotion_reason_min_length: 10
  require_approval_for_standardized: true
  require_approval_ticket_for_standardized: false
  require_approval_for_protected: true
  require_approval_ticket_for_protected: true

context_recovery:
  target_max_percent: 10
  warning_percent: 20
  danger_percent: 35

metrics:
  drift_window_size: 10

governance_contract:
  policy_schema_version: 2
  enforce_architect_runtime: true
  enforce_flow_runtime: true
  enforce_projection_runtime: true
  strict_cross_runtime_validation: false
`;
