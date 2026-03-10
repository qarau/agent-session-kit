import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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

function parseKeepSections(argv) {
  const raw = getArgValue(argv, '--keep-sections', '1');
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid --keep-sections value: "${raw}". Must be an integer >= 1.`);
  }
  return parsed;
}

function parseSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
  const headerLines = [];
  let currentSection = null;

  for (const line of lines) {
    const match = line.match(/^## (\d{4}-\d{2}-\d{2})$/);
    if (match) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        date: match[1],
        lines: [line],
      };
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return {
    header: headerLines.join('\n').trimEnd(),
    sections,
  };
}

function ensureArchiveHeader(content, monthKey) {
  if (content.trim().length > 0) {
    return content.trimEnd();
  }
  return `# Session Change Log Archive - ${monthKey}`;
}

function writeMonthlyArchive(repoRoot, monthKey, sections) {
  const archiveDir = path.join(repoRoot, 'docs', 'session', 'archive');
  const archivePath = path.join(archiveDir, `change-log-${monthKey}.md`);
  const existing = fs.existsSync(archivePath) ? fs.readFileSync(archivePath, 'utf8') : '';
  const base = ensureArchiveHeader(existing, monthKey);
  const payload = sections.map((section) => section.lines.join('\n').trimEnd()).join('\n\n');
  const nextContent = `${base}\n\n${payload}\n`;

  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(archivePath, nextContent);
  return archivePath;
}

function writeActiveChangeLog(changeLogPath, header, keptSections) {
  const keptPayload = keptSections.map((section) => section.lines.join('\n').trimEnd()).join('\n\n');
  const headerText = header.trim().length > 0 ? header.trimEnd() : '# Session Change Log';
  const nextContent =
    keptPayload.length > 0 ? `${headerText}\n\n${keptPayload}\n` : `${headerText}\n`;
  fs.writeFileSync(changeLogPath, nextContent);
}

function main() {
  const argv = process.argv.slice(2);
  const keepSections = parseKeepSections(argv);
  const repoRoot = process.cwd();
  const changeLogPath = path.join(repoRoot, 'docs', 'session', 'change-log.md');

  if (!fs.existsSync(changeLogPath)) {
    console.warn(`No change-log found at ${changeLogPath}.`);
    return;
  }

  const raw = fs.readFileSync(changeLogPath, 'utf8');
  const { header, sections } = parseSections(raw);

  if (sections.length <= keepSections) {
    console.log(
      `[archive-session-log] no-op (sections=${sections.length}, keep-sections=${keepSections})`
    );
    return;
  }

  const keptSections = sections.slice(0, keepSections);
  const archivedSections = sections.slice(keepSections);
  const archiveByMonth = new Map();

  for (const section of archivedSections) {
    const monthKey = section.date.slice(0, 7);
    const existing = archiveByMonth.get(monthKey) ?? [];
    existing.push(section);
    archiveByMonth.set(monthKey, existing);
  }

  const writtenArchives = [];
  for (const [monthKey, monthSections] of archiveByMonth.entries()) {
    const archivePath = writeMonthlyArchive(repoRoot, monthKey, monthSections);
    writtenArchives.push(archivePath);
  }

  writeActiveChangeLog(changeLogPath, header, keptSections);
  console.log(
    `[archive-session-log] archived ${archivedSections.length} section(s), kept ${keptSections.length}.`
  );
  for (const archivePath of writtenArchives) {
    console.log(`- ${archivePath}`);
  }
}

main();
