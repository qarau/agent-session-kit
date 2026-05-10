import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function normalize(value) {
  return String(value ?? '').trim();
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function slugify(value, fallback = 'plan') {
  const slug = normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug || fallback;
}

function toRelativeSlash(cwd, filePath) {
  const resolved = path.resolve(cwd, normalize(filePath));
  const relative = path.relative(cwd, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return normalize(filePath).replaceAll('\\', '/');
  }
  return relative.replaceAll('\\', '/');
}

function parseFileList(raw) {
  return String(raw ?? '')
    .split(/\r?\n/u)
    .map(normalize)
    .filter(Boolean)
    .map(filePath => filePath.replaceAll('\\', '/'));
}

export class ReadyPlanCommitRuntime {
  constructor(cwd) {
    this.cwd = cwd;
  }

  runGit(args, allowFailure = false, env = {}) {
    const result = spawnSync('git', args, {
      cwd: this.cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...env,
      },
    });
    const stdout = String(result.stdout ?? '').trim();
    const stderr = String(result.stderr ?? '').trim();
    if (result.status === 0) {
      return { ok: true, status: 0, stdout, stderr };
    }
    if (allowFailure) {
      return { ok: false, status: Number(result.status ?? 1), stdout, stderr };
    }
    throw new Error(`git ${args.join(' ')} failed: ${stderr || stdout}`.trim());
  }

  validateInput(options = {}) {
    const title = normalize(options.title);
    const markdownPath = normalize(options.sourceMarkdownPath || options.source);
    const planJsonPath = normalize(options.planJsonPath || options.planJson);
    const planId = slugify(options.planId || title, 'plan');

    if (!title) {
      return fail('ready-plan-missing-title', 'title is required');
    }
    if (!markdownPath) {
      return fail('ready-plan-missing-source', 'source markdown path is required');
    }
    if (!planJsonPath) {
      return fail('ready-plan-missing-plan-json', 'plan JSON path is required');
    }

    const markdownRelativePath = toRelativeSlash(this.cwd, markdownPath);
    const planJsonRelativePath = toRelativeSlash(this.cwd, planJsonPath);
    const paths = [markdownRelativePath, planJsonRelativePath];
    if (!paths.every(filePath => filePath.startsWith('docs/plans/'))) {
      return fail('ready-plan-path-outside-docs-plans', 'ready-plan artifacts must be under docs/plans', {
        paths,
      });
    }
    if (!markdownRelativePath.endsWith('.md') || !planJsonRelativePath.endsWith('.plan.json')) {
      return fail('ready-plan-invalid-artifact-shape', 'ready-plan artifacts must be a markdown file and .plan.json file', {
        markdownPath: markdownRelativePath,
        planJsonPath: planJsonRelativePath,
      });
    }
    for (const filePath of paths) {
      if (!fs.existsSync(path.join(this.cwd, filePath))) {
        return fail('ready-plan-artifact-not-found', `ready-plan artifact not found: ${filePath}`, {
          filePath,
        });
      }
    }

    return {
      ok: true,
      title,
      planId,
      markdownPath: markdownRelativePath,
      planJsonPath: planJsonRelativePath,
      allowedPaths: paths,
    };
  }

  stagedFiles() {
    const result = this.runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMRT'], true);
    return parseFileList(result.stdout);
  }

  changedFiles(paths) {
    const result = this.runGit(['status', '--short', '--', ...paths], true);
    return parseFileList(result.stdout).map(line => normalize(line.slice(3)));
  }

  headSha() {
    return normalize(this.runGit(['rev-parse', 'HEAD'], true).stdout);
  }

  async commit(options = {}) {
    const input = this.validateInput(options);
    if (!input.ok) {
      return input;
    }

    const allowedSet = new Set(input.allowedPaths);
    const preStaged = this.stagedFiles();
    const invalidPreStaged = preStaged.filter(filePath => !allowedSet.has(filePath));
    if (invalidPreStaged.length > 0) {
      return fail('ready-plan-dirty-index', 'ready-plan commit requires no pre-staged non-plan files', {
        stagedFiles: preStaged,
        invalidPreStaged,
      });
    }

    const beforeHead = this.headSha();
    const changed = this.changedFiles(input.allowedPaths);
    if (changed.length === 0) {
      return {
        ok: true,
        committed: false,
        title: input.title,
        planId: input.planId,
        markdownPath: input.markdownPath,
        planJsonPath: input.planJsonPath,
        footer: `ASK-Plan: ${input.planId}`,
        commit: {
          sha: beforeHead,
          subject: `chore(plan): ready ${input.title}`,
        },
        nextAction: `ask plan-mode handoff --title "${input.title}" --source ${input.markdownPath} --plan-json ${input.planJsonPath}`,
      };
    }

    const add = this.runGit(['add', '--', input.markdownPath, input.planJsonPath], true);
    if (!add.ok) {
      return fail('ready-plan-git-add-failed', 'failed to stage ready-plan artifacts', {
        stderr: add.stderr,
      });
    }

    const staged = this.stagedFiles();
    const invalidStaged = staged.filter(filePath => !allowedSet.has(filePath));
    if (invalidStaged.length > 0) {
      return fail('ready-plan-invalid-staged-files', 'ready-plan commit would include non-plan files', {
        stagedFiles: staged,
        invalidStaged,
      });
    }

    const subject = `chore(plan): ready ${input.title}`;
    const footer = `ASK-Plan: ${input.planId}`;
    const markdownFooter = `ASK-Plan-Markdown: ${input.markdownPath}`;
    const jsonFooter = `ASK-Plan-JSON: ${input.planJsonPath}`;
    const commit = this.runGit(['commit', '-m', subject, '-m', `${footer}\n${markdownFooter}\n${jsonFooter}`], true, {
      ASK_READY_PLAN_COMMIT: input.planId,
    });
    if (!commit.ok) {
      return fail('ready-plan-git-commit-failed', 'failed to create ready-plan commit', {
        stderr: commit.stderr,
        stdout: commit.stdout,
      });
    }

    return {
      ok: true,
      committed: true,
      title: input.title,
      planId: input.planId,
      markdownPath: input.markdownPath,
      planJsonPath: input.planJsonPath,
      footer,
      commit: {
        sha: this.headSha(),
        subject,
      },
      nextAction: `ask plan-mode handoff --title "${input.title}" --source ${input.markdownPath} --plan-json ${input.planJsonPath}`,
    };
  }
}
