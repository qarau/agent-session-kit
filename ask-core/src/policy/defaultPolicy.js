export const defaultPolicyYaml = `version: 1

session:
  require_resume_before_edit: true

checks:
  require_docs_freshness: true
  require_tests_before_commit: true
`;
