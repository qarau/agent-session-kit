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

function parseSection(markdown, sectionTitle) {
  const sectionRegex = new RegExp(`##\\s+${sectionTitle}\\s*([\\s\\S]*?)(?:\\n##\\s+|$)`, 'i');
  const match = markdown.match(sectionRegex);
  if (!match) {
    return '';
  }
  return match[1];
}

function parseLedgerVersions(sectionText) {
  const versions = new Set();
  const lines = sectionText.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*-\s+`(v\d+\.\d+\.\d+)`/i);
    if (match) {
      versions.add(match[1]);
    }
  }
  return versions;
}

function parseLatestVersion(latestMarkdown) {
  const match = latestMarkdown.match(/Current release:\s+`(v\d+\.\d+\.\d+)`/i);
  return match ? match[1] : '';
}

function parseLatestFileReference(latestMarkdown, label) {
  const referenceRegex = new RegExp(`${label}:\\s+\`([^\`]+)\``, 'i');
  const match = latestMarkdown.match(referenceRegex);
  return match ? match[1] : '';
}

function listVersionsFromFiles(files, regex, captureIndex = 1) {
  const versions = new Set();
  for (const file of files) {
    const match = file.match(regex);
    if (match) {
      versions.add(match[captureIndex]);
    }
  }
  return versions;
}

function ensureFileExists(filePath, errorMessage, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(errorMessage);
  }
}

function verifyReleaseDocs(rootDir) {
  const errors = [];
  const releasesDir = path.join(rootDir, 'docs', 'releases');
  const ledgerPath = path.join(releasesDir, 'README.md');
  const latestPath = path.join(releasesDir, 'latest.md');

  ensureFileExists(releasesDir, '[release-docs] releases directory is missing', errors);
  ensureFileExists(ledgerPath, '[release-docs] release ledger README is missing', errors);
  ensureFileExists(latestPath, '[release-docs] latest.md is missing', errors);
  if (errors.length > 0) {
    return errors;
  }

  const ledgerMarkdown = fs.readFileSync(ledgerPath, 'utf8');
  const latestMarkdown = fs.readFileSync(latestPath, 'utf8');
  const files = fs.readdirSync(releasesDir);

  const releasedVersions = parseLedgerVersions(parseSection(ledgerMarkdown, 'Released'));
  const draftVersions = parseLedgerVersions(parseSection(ledgerMarkdown, 'Unreleased Drafts'));

  const releasedFileVersions = listVersionsFromFiles(files, /^(v\d+\.\d+\.\d+)\.md$/i);
  const draftFileVersions = listVersionsFromFiles(files, /^(v\d+\.\d+\.\d+)-draft\.md$/i);

  const latestVersion = parseLatestVersion(latestMarkdown);
  if (!latestVersion) {
    errors.push('[release-docs] latest version marker is missing from latest.md');
  } else {
    if (!releasedVersions.has(latestVersion)) {
      errors.push(`[release-docs] latest version is not mapped in Released ledger: ${latestVersion}`);
    }

    const latestReleaseNotesRef = parseLatestFileReference(latestMarkdown, 'Release notes');
    const latestAnnouncementRef = parseLatestFileReference(latestMarkdown, 'Announcement copy');

    if (!latestReleaseNotesRef) {
      errors.push('[release-docs] latest release notes reference is missing from latest.md');
    } else if (!fs.existsSync(path.join(releasesDir, latestReleaseNotesRef))) {
      errors.push(`[release-docs] latest release notes file is missing: ${latestReleaseNotesRef}`);
    }

    if (!latestAnnouncementRef) {
      errors.push('[release-docs] latest announcement reference is missing from latest.md');
    } else if (!fs.existsSync(path.join(releasesDir, latestAnnouncementRef))) {
      errors.push(`[release-docs] latest announcement file is missing: ${latestAnnouncementRef}`);
    }
  }

  for (const version of releasedFileVersions) {
    if (!releasedVersions.has(version)) {
      errors.push(`[release-docs] released note not mapped in ledger: ${version}.md`);
    }
  }

  for (const version of releasedVersions) {
    if (!releasedFileVersions.has(version)) {
      errors.push(`[release-docs] released ledger entry missing note file: ${version}.md`);
    }
  }

  for (const version of draftFileVersions) {
    if (!draftVersions.has(version)) {
      errors.push(`[release-docs] draft note not mapped in ledger: ${version}-draft.md`);
    }
  }

  for (const version of draftVersions) {
    if (!draftFileVersions.has(version)) {
      errors.push(`[release-docs] draft ledger entry missing note file: ${version}-draft.md`);
    }
  }

  for (const version of releasedVersions) {
    if (draftVersions.has(version)) {
      errors.push(`[release-docs] version appears in both Released and Draft sections: ${version}`);
    }
  }

  return errors;
}

function main() {
  const argv = process.argv.slice(2);
  const rootDir = path.resolve(process.cwd(), getArgValue(argv, '--root', '.'));
  const errors = verifyReleaseDocs(rootDir);

  if (errors.length > 0) {
    console.error('[release-docs] guard failed');
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log('[release-docs] OK');
}

main();
