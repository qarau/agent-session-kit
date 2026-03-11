import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { resolveBranchEnforcementMode } from './resolveBranchEnforcementMode.mjs';

const REQUIRED_DOCS = ['docs/session/current-status.md', 'docs/session/change-log.md'];
const TASKS_DOC = 'docs/session/tasks.md';
const OPTIONAL_DOCS = [
  {
    path: 'docs/session/open-loops.md',
    reason: 'capture unresolved decision/risk context changes',
  },
];

function normalize(pathValue) {
  return pathValue.replaceAll('\\', '/').trim();
}

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

function resolveConfigPath(argv) {
  return path.resolve(process.cwd(), getArgValue(argv, '--config', 'docs/session/active-work-context.json'));
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function isTasksStrict(config) {
  if (process.env.SESSION_TASKS_STRICT === '1') {
    return true;
  }
  return config.strictTasksDoc === true;
}

function runGit(args, allowFailure = false) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }
    throw error;
  }
}

function parseFileList(raw) {
  if (!raw) {
    return [];
  }
  return raw
    .split('\n')
    .map(normalize)
    .filter(Boolean);
}

function getPreCommitFileList() {
  return parseFileList(runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMRT']));
}

function getPrePushFileList() {
  const upstream = runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], true);
  if (!upstream) {
    return parseFileList(runGit(['show', '--name-only', '--pretty=format:', 'HEAD'], true));
  }
  return parseFileList(runGit(['diff', '--name-only', '--diff-filter=ACMRT', `${upstream}..HEAD`], true));
}

function getFileListForMode(mode) {
  if (mode === 'pre-commit') {
    return getPreCommitFileList();
  }
  if (mode === 'pre-push') {
    return getPrePushFileList();
  }
  return getPreCommitFileList();
}

function getCurrentBranch() {
  return runGit(['branch', '--show-current'], true);
}

function hasLocalRuntimeFiles(files) {
  return files.some(file => normalize(file).startsWith('docs/ASK_Runtime/'));
}

function isEnforcementIgnored(filePath) {
  return (
    filePath.startsWith('docs/session/') ||
    filePath.startsWith('scripts/session/') ||
    filePath.startsWith('.githooks/')
  );
}

function evaluateFreshness(files, options = {}) {
  const strictTasksDoc = options.strictTasksDoc === true;
  const meaningfulChanges = files.filter(file => !isEnforcementIgnored(file));
  if (meaningfulChanges.length === 0) {
    return {
      ok: true,
      warnings: [],
      missing: [],
      meaningfulChanges,
    };
  }

  const requiredDocs = strictTasksDoc ? [...REQUIRED_DOCS, TASKS_DOC] : [...REQUIRED_DOCS];
  const missingRequired = requiredDocs.filter(required => !files.includes(required));
  const optionalDocs = strictTasksDoc
    ? OPTIONAL_DOCS
    : [
        {
          path: TASKS_DOC,
          reason: 'keep the active Now/Next/Done board current',
        },
        ...OPTIONAL_DOCS,
      ];
  const missingOptional = optionalDocs.filter(item => !files.includes(item.path)).map(
    item => `Optional check: update ${item.path} to ${item.reason}.`
  );

  return {
    ok: missingRequired.length === 0,
    warnings: missingOptional,
    missing: missingRequired,
    meaningfulChanges,
  };
}

function main() {
  if (process.env.SESSION_DOCS_BYPASS === '1') {
    console.warn('[session-freshness] bypassed via SESSION_DOCS_BYPASS=1');
    return;
  }

  const argv = process.argv.slice(2);
  const mode = getArgValue(argv, '--mode', 'preflight');
  const configPath = resolveConfigPath(argv);
  const config = loadConfig(configPath);
  const strictTasksDoc = isTasksStrict(config);
  const branchName = getCurrentBranch();
  const enforcementMode = resolveBranchEnforcementMode(branchName);
  const files = getFileListForMode(mode);

  if (hasLocalRuntimeFiles(files)) {
    console.error(`[session-freshness:${mode}] guard failed`);
    console.error('Local runtime files are not allowed in commits or pushes: docs/ASK_Runtime/*');
    process.exit(1);
  }

  const result = evaluateFreshness(files, { strictTasksDoc });

  if (!result.ok) {
    if (enforcementMode === 'advisory') {
      console.warn(
        `[session-freshness:${mode}] advisory mode (${branchName || 'detached-head'})`
      );
      console.warn('Missing required docs (not blocking on non-protected branch):');
      for (const item of result.missing) {
        console.warn(`- ${item}`);
      }
      console.warn('Meaningful changed files:');
      for (const item of result.meaningfulChanges) {
        console.warn(`- ${item}`);
      }
      return;
    }

    console.error(`[session-freshness:${mode}] guard failed`);
    console.error('Meaningful changes detected without required session doc updates.');
    if (strictTasksDoc) {
      console.error('Strict tasks mode is enabled: docs/session/tasks.md is required.');
    }
    console.error('Missing required docs:');
    for (const item of result.missing) {
      console.error(`- ${item}`);
    }
    console.error('Meaningful changed files:');
    for (const item of result.meaningfulChanges) {
      console.error(`- ${item}`);
    }
    process.exit(1);
  }

  console.log(`[session-freshness:${mode}] OK`);
  for (const warning of result.warnings) {
    console.warn(warning);
  }
}

main();
