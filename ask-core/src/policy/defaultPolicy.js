export const defaultPolicyYaml = `version: 1

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
  superpowers_allowed_skills: writing-plans,systematic-debugging,executing-plans,verification-before-completion
  superpowers_fallback_skill: executing-plans
  superpowers_incompatible_versions:

codex_context:
  enabled: false
  min_remaining_ratio: 0.10
  reserve_output_tokens: 12000
  max_context_tokens: 400000
  strategy: explicit
`;
