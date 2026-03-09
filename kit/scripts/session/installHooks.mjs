import { execFileSync } from 'node:child_process';

function main() {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
  const configured = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
    encoding: 'utf8',
  }).trim();
  console.log(`Configured core.hooksPath=${configured}`);
}

main();
