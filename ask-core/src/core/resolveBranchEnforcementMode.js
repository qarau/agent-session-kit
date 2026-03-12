export function resolveBranchEnforcementMode(branchName) {
  if (!branchName) {
    return 'advisory';
  }
  if (branchName === 'main' || branchName.startsWith('release/')) {
    return 'enforce';
  }
  return 'advisory';
}
