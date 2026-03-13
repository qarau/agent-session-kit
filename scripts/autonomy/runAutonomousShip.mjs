#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { runPhaseVerification } from './runPhaseVerification.mjs';

function runShell(command, label, dryRun) {
  console.log(`\n[autonomy] ${label}`);
  console.log(`[autonomy] run: ${command}`);
  if (dryRun) {
    return;
  }
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runGit(args, allowFailure = false) {
  try {
    return execFileSync('git', args, { cwd: process.cwd(), encoding: 'utf8' }).trim();
  } catch {
    if (allowFailure) {
      return '';
    }
    throw new Error(`git ${args.join(' ')} failed`);
  }
}

export function parseShipArgs(argv) {
  let phase = 'baseline';
  let dryRun = false;
  let message = '';
  let remote = 'origin';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--phase' && argv[i + 1]) {
      phase = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg === '--message' && argv[i + 1]) {
      message = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg === '--remote' && argv[i + 1]) {
      remote = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { phase, dryRun, message, remote };
}

export function resolveCommitMessage(cliMessage, env = process.env) {
  const direct = typeof cliMessage === 'string' ? cliMessage.trim() : '';
  if (direct) {
    return direct;
  }
  const fromEnv = typeof env.ASK_AUTONOMY_COMMIT_MESSAGE === 'string' ? env.ASK_AUTONOMY_COMMIT_MESSAGE.trim() : '';
  return fromEnv;
}

export function validateShipConfig(config) {
  if (config.dryRun) {
    return;
  }
  if (!config.message) {
    throw new Error(
      'commit message is required; pass --message "..." or set ASK_AUTONOMY_COMMIT_MESSAGE'
    );
  }
}

export function resolvePushArgs({ hasUpstream, remote, branch }) {
  if (hasUpstream) {
    return ['push'];
  }
  return ['push', '-u', remote, branch];
}

function ensureGitRepo() {
  const inRepo = runGit(['rev-parse', '--is-inside-work-tree'], true).toLowerCase();
  if (inRepo !== 'true') {
    throw new Error('current directory is not a git worktree');
  }
}

function main() {
  const parsed = parseShipArgs(process.argv.slice(2));
  const message = resolveCommitMessage(parsed.message, process.env);
  const config = { ...parsed, message };

  try {
    validateShipConfig(config);
    ensureGitRepo();

    runPhaseVerification(config.phase, { dryRun: config.dryRun });

    const branch = runGit(['branch', '--show-current'], true);
    if (!branch) {
      throw new Error('unable to resolve current git branch');
    }

    runShell('git add -A', 'stage changes', config.dryRun);

    if (!config.dryRun) {
      const staged = runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMRT'], true);
      if (!staged) {
        throw new Error('no staged changes after verification; nothing to commit');
      }
    }

    const safeMessage = config.message || '<commit-message>';
    const escapedMessage = safeMessage.replace(/"/g, '\\"');
    runShell(`git commit -m "${escapedMessage}"`, 'commit changes', config.dryRun);

    const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], true);
    const hasUpstream = Boolean(upstream);
    const pushArgs = resolvePushArgs({ hasUpstream, remote: config.remote, branch });
    runShell(`git ${pushArgs.join(' ')}`, 'push branch', config.dryRun);

    console.log('\n[autonomy] ship complete');
  } catch (error) {
    console.error(`[autonomy] ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
