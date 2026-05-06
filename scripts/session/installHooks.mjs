import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function getGitValue(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function resolveHooksDir(repoRoot) {
  const hooksPath = getGitValue(['config', '--get', 'core.hooksPath']) || '.githooks';
  if (path.isAbsolute(hooksPath)) {
    return hooksPath;
  }
  return path.resolve(repoRoot, hooksPath);
}

function ensureHookExecutable(hooksDir, fileName) {
  const hookPath = path.join(hooksDir, fileName);
  if (!fs.existsSync(hookPath)) {
    return;
  }

  if (process.platform === 'win32') {
    return;
  }

  fs.chmodSync(hookPath, 0o755);
  console.log(`Ensured executable bit: ${hookPath}`);
}

function main() {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
  const repoRoot = getGitValue(['rev-parse', '--show-toplevel']);
  const configured = getGitValue(['config', '--get', 'core.hooksPath']);
  const hooksDir = resolveHooksDir(repoRoot);

  ensureHookExecutable(hooksDir, 'pre-commit');
  ensureHookExecutable(hooksDir, 'pre-push');
  ensureHookExecutable(hooksDir, 'post-commit');

  console.log(`Configured core.hooksPath=${configured}`);
}

main();
