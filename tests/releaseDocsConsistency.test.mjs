import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testDir = path.dirname(thisFilePath);
const kitRoot = path.resolve(testDir, '..');
const verifierPath = path.join(kitRoot, 'scripts', 'verifyReleaseDocsConsistency.mjs');

function runVerifier(rootDir) {
  const result = spawnSync(process.execPath, [verifierPath, '--root', rootDir], {
    cwd: kitRoot,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function writeReleaseFiles(rootDir, options) {
  const releasesDir = path.join(rootDir, 'docs', 'releases');
  fs.mkdirSync(releasesDir, { recursive: true });

  const releasedList = options.releasedVersions
    .map((version) => `- \`${version}\` - released\n  - Notes: \`${version}.md\`\n  - Announcement: \`${version}-announcement.md\``)
    .join('\n\n');
  const draftList = options.draftVersions
    .map((version) => `- \`${version}\` (draft) - unreleased\n  - Notes: \`${version}-draft.md\``)
    .join('\n\n');

  fs.writeFileSync(
    path.join(releasesDir, 'README.md'),
    `# ASK Release Ledger

## Released

${releasedList}

## Unreleased Drafts

${draftList}
`
  );

  fs.writeFileSync(
    path.join(releasesDir, 'latest.md'),
    `# Latest Release

Current release: \`${options.latestVersion}\` (2026-03-11)

- Release notes: \`${options.latestVersion}.md\`
- Announcement copy: \`${options.latestVersion}-announcement.md\`
`
  );

  for (const version of options.releasedVersions) {
    fs.writeFileSync(path.join(releasesDir, `${version}.md`), `# ${version}\n`);
    fs.writeFileSync(path.join(releasesDir, `${version}-announcement.md`), `# ${version} announcement\n`);
  }

  for (const version of options.draftVersions) {
    fs.writeFileSync(path.join(releasesDir, `${version}-draft.md`), `# ${version} draft\n`);
  }
}

test('release docs verifier passes for consistent mapping', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-release-docs-pass-'));
  writeReleaseFiles(tempRoot, {
    latestVersion: 'v0.1.6',
    releasedVersions: ['v0.1.6'],
    draftVersions: ['v0.1.7'],
  });

  const result = runVerifier(tempRoot);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /\[release-docs\] OK/);
});

test('release docs verifier fails when latest points to missing release note', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-release-docs-fail-'));
  writeReleaseFiles(tempRoot, {
    latestVersion: 'v0.1.8',
    releasedVersions: ['v0.1.6'],
    draftVersions: ['v0.1.7'],
  });

  const result = runVerifier(tempRoot);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /latest release notes file is missing/i);
});

test('release docs verifier fails when released note is missing in ledger', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-release-docs-ledger-fail-'));
  writeReleaseFiles(tempRoot, {
    latestVersion: 'v0.1.6',
    releasedVersions: ['v0.1.6'],
    draftVersions: ['v0.1.7'],
  });

  fs.writeFileSync(path.join(tempRoot, 'docs', 'releases', 'v0.1.5.md'), '# v0.1.5\n');
  fs.writeFileSync(path.join(tempRoot, 'docs', 'releases', 'v0.1.5-announcement.md'), '# v0.1.5 announcement\n');

  const result = runVerifier(tempRoot);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /released note not mapped in ledger/i);
});
