import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function normalize(value) {
  return value.replaceAll('\\', '/');
}

function getOptionValue(argv, name, fallback) {
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

function getMode(argv) {
  return getOptionValue(argv, '--mode', 'preflight');
}

function resolveConfigPath(argv) {
  const configValue = getOptionValue(argv, '--config', 'docs/session/active-work-context.json');
  return path.resolve(process.cwd(), configValue);
}

function getGitValue(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function getGitValueOptional(args) {
  try {
    return getGitValue(args);
  } catch {
    return '';
  }
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

function readRepoWorkContextLock() {
  const enabledRaw = getGitValueOptional(['config', '--get', 'session.workContextLock.enabled']);
  const expectedBranch = getGitValueOptional([
    'config',
    '--get',
    'session.workContextLock.expectedBranch',
  ]);
  const expectedRepoPathSuffix = getGitValueOptional([
    'config',
    '--get',
    'session.workContextLock.expectedRepoPathSuffix',
  ]);
  const enforceRepoPathSuffixRaw = getGitValueOptional([
    'config',
    '--get',
    'session.workContextLock.enforceRepoPathSuffix',
  ]);

  const hasAnyLockValue =
    enabledRaw.length > 0 ||
    expectedBranch.length > 0 ||
    expectedRepoPathSuffix.length > 0 ||
    enforceRepoPathSuffixRaw.length > 0;
  const enabled = parseBoolean(enabledRaw, false) || (enabledRaw.length === 0 && hasAnyLockValue);
  if (!enabled) {
    return {
      enabled: false,
    };
  }

  return {
    enabled: true,
    expectedBranch,
    expectedRepoPathSuffix,
    enforceRepoPathSuffix: parseBoolean(enforceRepoPathSuffixRaw, false),
  };
}

function resolveEffectiveConfig(config) {
  const repoLock = readRepoWorkContextLock();
  if (!repoLock.enabled) {
    return {
      source: 'active-work-context',
      config,
      repoLock,
    };
  }

  if (!repoLock.expectedBranch) {
    throw new Error(
      'Invalid repo work-context lock: expectedBranch is required when session.workContextLock.enabled=true.'
    );
  }

  return {
    source: 'repo-lock',
    config: {
      ...config,
      expectedBranch: repoLock.expectedBranch,
      expectedRepoPathSuffix: repoLock.expectedRepoPathSuffix,
      enforceRepoPathSuffix: repoLock.enforceRepoPathSuffix,
    },
    repoLock,
  };
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
  const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const effectiveContext = resolveEffectiveConfig(fileConfig);
  const config = effectiveContext.config;
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
    if (effectiveContext.source === 'repo-lock') {
      console.error(
        '- Repo work-context lock is active via git config (session.workContextLock.*).'
      );
    }
    for (const violation of result.violations) {
      console.error(`- ${violation}`);
    }
    console.error('Switch to the intended worktree/branch before committing or pushing.');
    process.exit(1);
  }

  if (effectiveContext.source === 'repo-lock') {
    console.log(`[work-context:${mode}] OK (${configPath}, source=repo-lock)`);
    return;
  }

  console.log(`[work-context:${mode}] OK (${configPath}, source=active-work-context)`);
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main();
}
