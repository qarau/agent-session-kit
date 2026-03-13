const BRANCH_ENFORCEMENT_MODE_ALL = 'all';
const BRANCH_ENFORCEMENT_MODE_PROTECTED = 'protected';
const BRANCH_ENFORCEMENT_MODE_ADVISORY = 'advisory';

export function normalizeBranchEnforcementMode(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === BRANCH_ENFORCEMENT_MODE_ALL ||
    normalized === BRANCH_ENFORCEMENT_MODE_PROTECTED ||
    normalized === BRANCH_ENFORCEMENT_MODE_ADVISORY
  ) {
    return normalized;
  }
  return '';
}

export function resolveBranchEnforcementMode(branchName, configuredMode = BRANCH_ENFORCEMENT_MODE_PROTECTED) {
  const mode = normalizeBranchEnforcementMode(configuredMode) || BRANCH_ENFORCEMENT_MODE_PROTECTED;
  if (mode === BRANCH_ENFORCEMENT_MODE_ADVISORY) {
    return 'advisory';
  }
  if (!branchName) {
    return 'advisory';
  }
  if (mode === BRANCH_ENFORCEMENT_MODE_ALL) {
    return 'enforce';
  }
  if (branchName === 'main' || branchName.startsWith('release/')) {
    return 'enforce';
  }
  return 'advisory';
}
