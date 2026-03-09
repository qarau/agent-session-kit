import { execFileSync } from 'node:child_process';

function unsetGitConfig(key) {
  try {
    execFileSync('git', ['config', '--local', '--unset-all', key], {
      stdio: 'ignore',
    });
  } catch {
    // Ignore missing keys so clear can be run idempotently.
  }
}

function main() {
  unsetGitConfig('session.workContextLock.enabled');
  unsetGitConfig('session.workContextLock.expectedBranch');
  unsetGitConfig('session.workContextLock.expectedRepoPathSuffix');
  unsetGitConfig('session.workContextLock.enforceRepoPathSuffix');
  console.log('Repo work-context lock cleared.');
}

main();
