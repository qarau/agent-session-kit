import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function normalize(value) {
  return value.replaceAll('\\', '/');
}

function getMode(argv) {
  const modeArg = argv.find(arg => arg.startsWith('--mode='));
  return modeArg ? modeArg.slice('--mode='.length) : 'preflight';
}

function resolveConfigPath(argv) {
  const configArg = argv.find(arg => arg.startsWith('--config='));
  if (!configArg) {
    return path.resolve(process.cwd(), 'docs/session/active-work-context.json');
  }
  return path.resolve(process.cwd(), configArg.slice('--config='.length));
}

function getGitValue(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function evaluate(config, runtime) {
  const violations = [];
  const expectedBranch = config.expectedBranch;
  const expectedRepoPathSuffix = config.expectedRepoPathSuffix;
  const enforceRepoPathSuffix = config.enforceRepoPathSuffix === true;

  if (!expectedBranch || typeof expectedBranch !== 'string') {
    throw new Error('Invalid active-work-context config: expectedBranch is required.');
  }

  if (runtime.currentBranch !== expectedBranch) {
    violations.push(
      `Branch mismatch: expected "${expectedBranch}", got "${runtime.currentBranch}".`
    );
  }

  if (enforceRepoPathSuffix) {
    if (!expectedRepoPathSuffix || typeof expectedRepoPathSuffix !== 'string') {
      throw new Error(
        'Invalid active-work-context config: expectedRepoPathSuffix is required when enforceRepoPathSuffix=true.'
      );
    }

    if (!normalize(runtime.repoTopLevel).endsWith(normalize(expectedRepoPathSuffix))) {
      violations.push(
        `Worktree mismatch: expected repo path suffix "${normalize(expectedRepoPathSuffix)}", got "${normalize(runtime.repoTopLevel)}".`
      );
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

function main() {
  const argv = process.argv.slice(2);
  const mode = getMode(argv);
  const configPath = resolveConfigPath(argv);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const bypassEnvVar =
    typeof config.bypassEnvVar === 'string' && config.bypassEnvVar.length > 0
      ? config.bypassEnvVar
      : 'SESSION_CONTEXT_BYPASS';

  if (process.env[bypassEnvVar] === '1') {
    console.warn(`[work-context:${mode}] bypassed via ${bypassEnvVar}=1`);
    return;
  }

  const runtime = {
    currentBranch: getGitValue(['branch', '--show-current']),
    repoTopLevel: getGitValue(['rev-parse', '--show-toplevel']),
  };
  const result = evaluate(config, runtime);

  if (!result.ok) {
    console.error(`[work-context:${mode}] guard failed`);
    console.error(`Config: ${configPath}`);
    for (const violation of result.violations) {
      console.error(`- ${violation}`);
    }
    console.error('Switch to the intended worktree/branch before committing or pushing.');
    process.exit(1);
  }

  console.log(`[work-context:${mode}] OK (${configPath})`);
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main();
}
