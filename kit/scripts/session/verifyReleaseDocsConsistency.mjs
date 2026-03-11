import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

import { verifyReleaseDocs } from './releaseDocsConsistencyCore.mjs';
import { resolveBranchEnforcementMode } from './resolveBranchEnforcementMode.mjs';

function getArgValue(argv, name, fallback) {
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

function getCurrentBranch() {
  try {
    return execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function main() {
  const argv = process.argv.slice(2);
  const mode = getArgValue(argv, '--mode', 'preflight');
  const rootDir = path.resolve(process.cwd(), getArgValue(argv, '--root', '.'));
  const branchName = getCurrentBranch();
  const enforcementMode = resolveBranchEnforcementMode(branchName);
  const errors = verifyReleaseDocs(rootDir);

  if (errors.length > 0) {
    if (enforcementMode === 'advisory') {
      console.warn(`[release-docs:${mode}] advisory mode (${branchName || 'detached-head'})`);
      for (const error of errors) {
        console.warn(` - ${error}`);
      }
      return;
    }

    console.error(`[release-docs:${mode}] guard failed`);
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log(`[release-docs:${mode}] OK`);
}

main();
