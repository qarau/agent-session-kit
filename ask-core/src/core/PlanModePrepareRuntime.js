import fs from 'node:fs';
import path from 'node:path';

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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toRelativeSlash(cwd, filePath) {
  const resolved = path.resolve(cwd, normalize(filePath));
  const relative = path.relative(cwd, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return normalize(filePath).replaceAll('\\', '/');
  }
  return relative.replaceAll('\\', '/');
}

function stripSlicePrefix(value) {
  return normalize(value).replace(/^slice\s+\d+\s*[-:]?\s*/iu, '').trim();
}

function readHeading(line) {
  const match = normalize(line).match(/^(#{1,6})\s+(.+)$/u);
  if (!match) {
    return null;
  }
  return {
    level: match[1].length,
    title: normalize(match[2]),
  };
}

function isSliceHeading(line) {
  return /^#{2,3}\s+slice\s+\d+\s*[-:]?\s+\S/iu.test(normalize(line));
}

function readHeadingTitle(line) {
  return stripSlicePrefix(readHeading(line)?.title ?? '');
}

function isSliceContainerHeading(line) {
  const heading = readHeading(line);
  return heading?.level === 2 && /^(?:implementation\s+)?slices$/iu.test(heading.title);
}

function isAcceptanceMarker(line) {
  return /^#{2,6}\s+acceptance criteria\s*:?$/iu.test(normalize(line))
    || /^acceptance criteria\s*:?$/iu.test(normalize(line));
}

function readBullet(line) {
  const match = normalize(line).match(/^(?:[-*]|\d+[.)])\s+(.+)$/u);
  return match ? normalize(match[1]) : '';
}

function uniqueSliceId(base, seen) {
  const root = slugify(base, 'slice');
  let candidate = root;
  let counter = 2;
  while (seen.has(candidate)) {
    candidate = `${root}-${String(counter)}`;
    counter += 1;
  }
  seen.add(candidate);
  return candidate;
}

function findBlockEnd(lines, startIndex, candidateIndexes) {
  const startLevel = readHeading(lines[startIndex])?.level ?? 6;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (candidateIndexes.includes(index)) {
      return index;
    }
    const heading = readHeading(lines[index]);
    if (heading && heading.level <= startLevel) {
      return index;
    }
  }
  return lines.length;
}

function parseSliceBlock(lines, startIndex, endIndex, previousSliceId, seen) {
  const title = readHeadingTitle(lines[startIndex]);
  const description = [];
  const acceptanceCriteria = [];
  let inAcceptance = false;

  for (let index = startIndex + 1; index < endIndex; index += 1) {
    const line = normalize(lines[index]);
    if (!line) {
      continue;
    }
    if (isAcceptanceMarker(line)) {
      inAcceptance = true;
      continue;
    }
    if (inAcceptance) {
      const bullet = readBullet(line);
      if (bullet) {
        acceptanceCriteria.push(bullet);
      }
      continue;
    }
    if (!line.startsWith('#')) {
      description.push(line);
    }
  }

  const sliceId = uniqueSliceId(title, seen);
  const slice = {
    sliceId,
    title,
    description: description.join(' ') || `Implement ${title}.`,
    acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : [`${title} is implemented`],
    queueClass: 'integrator',
  };
  if (previousSliceId) {
    slice.dependsOn = [previousSliceId];
  }
  return slice;
}

function fallbackSlice(title, seen) {
  return {
    sliceId: uniqueSliceId(title, seen),
    title,
    description: `Implement ${title}.`,
    acceptanceCriteria: [`${title} is implemented`],
    queueClass: 'integrator',
  };
}

function countSliceContainerItems(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!isSliceContainerHeading(lines[index])) {
      continue;
    }
    const containerLevel = readHeading(lines[index])?.level ?? 2;
    let itemCount = 0;
    for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
      const line = normalize(lines[childIndex]);
      const heading = readHeading(line);
      if (heading && heading.level <= containerLevel) {
        break;
      }
      if (readBullet(line)) {
        itemCount += 1;
      }
    }
    return itemCount;
  }
  return 0;
}

function extractSlices(markdown, title) {
  const lines = String(markdown ?? '').split(/\r?\n/u);
  let headingIndexes = [];
  let sourceFormat = 'ask-slice-headings';
  const warnings = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (isSliceHeading(lines[index])) {
      headingIndexes.push(index);
    }
  }

  if (headingIndexes.length < 1) {
    sourceFormat = 'slices-section-child-headings';
    for (let index = 0; index < lines.length; index += 1) {
      if (!isSliceContainerHeading(lines[index])) {
        continue;
      }
      const containerLevel = readHeading(lines[index])?.level ?? 2;
      const childLevel = containerLevel + 1;
      for (let childIndex = index + 1; childIndex < lines.length; childIndex += 1) {
        const heading = readHeading(lines[childIndex]);
        if (!heading) {
          continue;
        }
        if (heading.level <= containerLevel) {
          break;
        }
        if (heading.level === childLevel) {
          headingIndexes.push(childIndex);
        }
      }
      if (headingIndexes.length > 0) {
        break;
      }
    }
  }

  const seen = new Set();
  if (headingIndexes.length < 1) {
    if (countSliceContainerItems(lines) > 1) {
      return fail(
        'plan-slice-extraction-ambiguous',
        'Plan appears to contain multiple slices but ASK could not parse them. Use headings like `## Slice N: Title` or `## Slices` followed by child headings such as `### Title`.'
      );
    }
    const slice = fallbackSlice(title, seen);
    return {
      ok: true,
      slices: [slice],
      sourceFormat: 'fallback-single-slice',
      warnings,
    };
  }

  const slices = [];
  for (let index = 0; index < headingIndexes.length; index += 1) {
    const start = headingIndexes[index];
    const end = findBlockEnd(lines, start, headingIndexes);
    const previousSliceId = slices.at(-1)?.sliceId ?? '';
    slices.push(parseSliceBlock(lines, start, end, previousSliceId, seen));
  }
  return {
    ok: true,
    slices,
    sourceFormat,
    warnings,
  };
}

export class PlanModePrepareRuntime {
  constructor(cwd) {
    this.cwd = cwd;
  }

  validateInput(options = {}) {
    const title = normalize(options.title);
    const sourcePath = normalize(options.sourceMarkdownPath || options.source);
    const planPrefix = slugify(options.planPrefix || options.prefix || title, 'plan');
    const date = normalize(options.date) || todayIsoDate();

    if (!title) {
      return fail('missing-title', 'title is required');
    }
    if (!sourcePath) {
      return fail('missing-source', 'source markdown path is required');
    }
    if (!/^[a-z][a-z0-9-]*$/u.test(planPrefix)) {
      return fail('invalid-plan-prefix', 'plan prefix must match ^[a-z][a-z0-9-]*$');
    }

    const sourceAbsolutePath = path.resolve(this.cwd, sourcePath);
    if (!fs.existsSync(sourceAbsolutePath)) {
      return fail('source-not-found', `source markdown path does not exist: ${sourcePath}`);
    }

    return {
      ok: true,
      title,
      sourceAbsolutePath,
      planPrefix,
      date,
    };
  }

  async prepare(options = {}) {
    const input = this.validateInput(options);
    if (!input.ok) {
      return input;
    }

    const markdown = fs.readFileSync(input.sourceAbsolutePath, 'utf8');
    const baseName = `${input.date}-${slugify(input.title)}`;
    const markdownPath = path.join('docs', 'plans', `${baseName}.md`);
    const planJsonPath = path.join('docs', 'plans', `${baseName}.plan.json`);
    const markdownAbsolutePath = path.join(this.cwd, markdownPath);
    const planJsonAbsolutePath = path.join(this.cwd, planJsonPath);
    const extraction = extractSlices(markdown, input.title);
    if (!extraction.ok) {
      return extraction;
    }

    const plan = {
      schemaVersion: 2,
      planPrefix: input.planPrefix,
      planTitle: input.title,
      planSummary: `Generated from ${toRelativeSlash(this.cwd, input.sourceAbsolutePath)}`,
      slices: extraction.slices,
    };

    fs.mkdirSync(path.dirname(markdownAbsolutePath), { recursive: true });
    fs.writeFileSync(markdownAbsolutePath, markdown.endsWith('\n') ? markdown : `${markdown}\n`, 'utf8');
    fs.writeFileSync(planJsonAbsolutePath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');

    const markdownRelativePath = markdownPath.replaceAll('\\', '/');
    const planJsonRelativePath = planJsonPath.replaceAll('\\', '/');
    return {
      ok: true,
      title: input.title,
      planPrefix: input.planPrefix,
      markdownPath: markdownRelativePath,
      planJsonPath: planJsonRelativePath,
      sliceCount: plan.slices.length,
      sliceTitles: plan.slices.map(slice => slice.title),
      sourceFormat: extraction.sourceFormat,
      warnings: extraction.warnings,
      slices: plan.slices.map(slice => ({
        sliceId: slice.sliceId,
        title: slice.title,
        dependsOn: Array.isArray(slice.dependsOn) ? [...slice.dependsOn] : [],
      })),
      nextAction: `ask plan-mode handoff --title "${input.title}" --source ${markdownRelativePath} --plan-json ${planJsonRelativePath}`,
    };
  }
}
