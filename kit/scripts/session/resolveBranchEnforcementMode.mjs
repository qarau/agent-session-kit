export function resolveBranchEnforcementMode(branchName) {
  const branch = typeof branchName === 'string' ? branchName.trim() : '';
  if (branch === 'main' || branch.startsWith('release/')) {
    return 'enforce';
  }

  return 'advisory';
}
