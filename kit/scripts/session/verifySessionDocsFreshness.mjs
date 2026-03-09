import process from 'node:process';
import { execFileSync } from 'node:child_process';

const REQUIRED_DOCS = ['docs/session/current-status.md', 'docs/session/change-log.md'];
const OPTIONAL_DOC = 'docs/session/open-loops.md';

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

function isEnforcementIgnored(filePath) {
  return (
    filePath.startsWith('docs/session/') ||
    filePath.startsWith('scripts/session/') ||
    filePath.startsWith('.githooks/')
  );
}

function evaluateFreshness(files) {
  const meaningfulChanges = files.filter(file => !isEnforcementIgnored(file));
  if (meaningfulChanges.length === 0) {
    return {
      ok: true,
      warning: null,
      missing: [],
      meaningfulChanges,
    };
  }

  const missingRequired = REQUIRED_DOCS.filter(required => !files.includes(required));
  const missingOptional = !files.includes(OPTIONAL_DOC);

  return {
    ok: missingRequired.length === 0,
    warning: missingOptional
      ? `Optional check: update ${OPTIONAL_DOC} if decision/risk context changed.`
      : null,
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
  const files = getFileListForMode(mode);
  const result = evaluateFreshness(files);

  if (!result.ok) {
    console.error(`[session-freshness:${mode}] guard failed`);
    console.error('Meaningful changes detected without required session doc updates.');
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
  if (result.warning) {
    console.warn(result.warning);
  }
}

main();
