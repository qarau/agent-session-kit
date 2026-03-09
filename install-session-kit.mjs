import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const args = {
    target: '',
    branch: 'main',
    repoSuffix: '',
    enforcePathSuffix: false,
    force: false,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg.startsWith('--target=')) {
      args.target = arg.slice('--target='.length);
      continue;
    }
    if (arg === '--target' && next) {
      args.target = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--branch=')) {
      args.branch = arg.slice('--branch='.length);
      continue;
    }
    if (arg === '--branch' && next) {
      args.branch = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--repo-suffix=')) {
      args.repoSuffix = arg.slice('--repo-suffix='.length);
      continue;
    }
    if (arg === '--repo-suffix' && next) {
      args.repoSuffix = next;
      index += 1;
      continue;
    }
    if (arg.startsWith('--enforce-path-suffix=')) {
      args.enforcePathSuffix = arg.slice('--enforce-path-suffix='.length) === 'true';
      continue;
    }
    if (arg === '--enforce-path-suffix' && next) {
      args.enforcePathSuffix = next === 'true';
      index += 1;
      continue;
    }
    if (arg === '--force') {
      args.force = true;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
    }
  }

  return args;
}

function ensureGitRepo(targetPath) {
  const gitDir = path.join(targetPath, '.git');
  if (!fs.existsSync(gitDir)) {
    throw new Error(`Target is not a git repo: ${targetPath}`);
  }
}

function copyDirectory(sourceDir, targetDir, force, dryRun) {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      if (!dryRun) {
        fs.mkdirSync(targetPath, { recursive: true });
      }
      copyDirectory(sourcePath, targetPath, force, dryRun);
      continue;
    }

    if (fs.existsSync(targetPath) && !force) {
      console.log(`[skip] ${targetPath} (exists, use --force to overwrite)`);
      continue;
    }

    if (dryRun) {
      console.log(`[copy] ${sourcePath} -> ${targetPath}`);
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`[copied] ${targetPath}`);
  }
}

function updateActiveWorkContext(targetPath, args) {
  const configPath = path.join(targetPath, 'docs', 'session', 'active-work-context.json');
  if (!fs.existsSync(configPath)) {
    return;
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  config.expectedBranch = args.branch;
  config.expectedRepoPathSuffix = args.repoSuffix;
  config.enforceRepoPathSuffix = args.enforcePathSuffix;

  if (args.dryRun) {
    console.log(`[update] ${configPath}`);
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`[updated] ${configPath}`);
}

function configureHooks(targetPath, dryRun) {
  if (dryRun) {
    console.log(`[git-config] git -C "${targetPath}" config core.hooksPath .githooks`);
    return;
  }
  execFileSync('git', ['-C', targetPath, 'config', 'core.hooksPath', '.githooks'], {
    stdio: 'inherit',
  });
}

function ensureHookExecutables(targetPath, dryRun) {
  if (process.platform === 'win32') {
    return;
  }

  const hooks = ['pre-commit', 'pre-push'];
  for (const hook of hooks) {
    const hookPath = path.join(targetPath, '.githooks', hook);
    if (!fs.existsSync(hookPath)) {
      continue;
    }

    if (dryRun) {
      console.log(`[chmod] ${hookPath} -> 755`);
      continue;
    }

    fs.chmodSync(hookPath, 0o755);
    console.log(`[chmod] ${hookPath} -> 755`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetPath = path.resolve(args.target || process.cwd());
  const thisFilePath = fileURLToPath(import.meta.url);
  const kitPath = path.resolve(path.dirname(thisFilePath), 'kit');

  if (!fs.existsSync(kitPath)) {
    throw new Error(`Missing kit directory: ${kitPath}`);
  }

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Target path does not exist: ${targetPath}`);
  }

  ensureGitRepo(targetPath);
  copyDirectory(kitPath, targetPath, args.force, args.dryRun);
  updateActiveWorkContext(targetPath, args);
  ensureHookExecutables(targetPath, args.dryRun);
  configureHooks(targetPath, args.dryRun);

  console.log('\nAgent Session Kit install complete.');
  console.log(`Target: ${targetPath}`);
  console.log('\nNext steps:');
  console.log('1. node scripts/session/installHooks.mjs');
  console.log('2. node scripts/session/verifyWorkContext.mjs --mode=preflight');
  console.log('3. node scripts/session/verifySessionDocsFreshness.mjs --mode=preflight');
  console.log(
    '4. Optional: node scripts/session/setRepoWorkContextLock.mjs --branch <branch> --repo-suffix <suffix> --enforce-path-suffix true'
  );
}

main();
