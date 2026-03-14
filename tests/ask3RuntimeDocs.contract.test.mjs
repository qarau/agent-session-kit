import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(repoRoot, 'ask-core', 'bin', 'ask.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

test('ask cli help includes delivery-governance command families', () => {
  const result = run(process.execPath, [askBinPath], { cwd: repoRoot });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /ask feature create\|link-task\|status/i);
  assert.match(result.stdout, /ask release create\|link-feature\|status/i);
  assert.match(result.stdout, /ask promote require\|pass\|advance\|status/i);
  assert.match(result.stdout, /ask rollout start\|phase\|status/i);
  assert.match(result.stdout, /ask rollback trigger/i);
});

test('ask docs publish ask 3.0 session-os architecture and migration guidance', () => {
  const readme = fs.readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  const howItWorks = fs.readFileSync(path.join(repoRoot, 'docs', 'how-it-works.md'), 'utf8');
  const adoption = fs.readFileSync(path.join(repoRoot, 'docs', 'adoption-guide.md'), 'utf8');
  const maintainer = fs.readFileSync(path.join(repoRoot, 'docs', 'maintainer-mode.md'), 'utf8');
  const architecturePath = path.join(repoRoot, 'docs', 'ask-3.0-architecture.md');

  assert.equal(fs.existsSync(architecturePath), true);
  const architecture = fs.readFileSync(architecturePath, 'utf8');

  assert.match(readme, /ASK 3\.0/i);
  assert.match(readme, /event-ledger runtime|session os/i);
  assert.match(howItWorks, /ask feature create\|link-task\|status/i);
  assert.match(howItWorks, /ask release create\|link-feature\|status/i);
  assert.match(howItWorks, /ask promote require\|pass\|advance\|status/i);
  assert.match(howItWorks, /ask rollout start\|phase\|status/i);
  assert.match(howItWorks, /ask rollback trigger/i);
  assert.match(adoption, /bridge mode/i);
  assert.match(adoption, /cutover mode/i);
  assert.match(maintainer, /projection snapshots authoritative/i);
  assert.match(architecture, /ASK 3\.0 Architecture/i);
});
