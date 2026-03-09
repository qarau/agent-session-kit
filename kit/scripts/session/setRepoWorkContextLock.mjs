import process from 'node:process';
import { execFileSync } from 'node:child_process';

function getArgValue(argv, name, fallback = '') {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        return fallback;
      }
      return next;
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return fallback;
}

function parseBoolean(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }
  const normalized = value.toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  return fallback;
}

function setGitConfig(key, value) {
  execFileSync('git', ['config', '--local', key, value], {
    stdio: 'inherit',
  });
}

function main() {
  const argv = process.argv.slice(2);
  const branch = getArgValue(argv, '--branch');
  if (!branch) {
    throw new Error('Missing required --branch value.');
  }

  const repoSuffix = getArgValue(argv, '--repo-suffix', '');
  const enforcePathSuffix = parseBoolean(getArgValue(argv, '--enforce-path-suffix', ''), false);

  setGitConfig('session.workContextLock.enabled', 'true');
  setGitConfig('session.workContextLock.expectedBranch', branch);
  setGitConfig('session.workContextLock.expectedRepoPathSuffix', repoSuffix);
  setGitConfig(
    'session.workContextLock.enforceRepoPathSuffix',
    enforcePathSuffix ? 'true' : 'false'
  );

  console.log('Repo work-context lock enabled.');
  console.log(`- branch: ${branch}`);
  console.log(`- repo path suffix: ${repoSuffix}`);
  console.log(`- enforce path suffix: ${enforcePathSuffix ? 'true' : 'false'}`);
}

main();
