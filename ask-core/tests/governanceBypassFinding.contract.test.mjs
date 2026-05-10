import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runOrThrow(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      `status=${String(result.status)}`,
      result.stdout,
      result.stderr,
    ].join('\n'));
  }
  return result;
}

function setupRepo() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-governance-bypass-'));
  runOrThrow('git', ['init'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: tempRoot });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: tempRoot });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: tempRoot });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: tempRoot });
  return tempRoot;
}

test('missing plan handoff creates explainable governance bypass finding', () => {
  const repoDir = setupRepo();
  const preflight = run(process.execPath, [askBinPath, 'implementation', 'preflight'], { cwd: repoDir });
  assert.equal(preflight.status, 1, preflight.stdout + preflight.stderr);
  const preflightPayload = JSON.parse(preflight.stdout);
  assert.equal(preflightPayload.findings.length, 1);

  const listed = runOrThrow(process.execPath, [askBinPath, 'architect', 'finding', 'list'], { cwd: repoDir });
  const findings = JSON.parse(listed.stdout).findings;
  const bypass = findings.find(finding => finding.metric === 'governance_bypass');
  assert.ok(bypass, JSON.stringify(findings));
  assert.equal(bypass.severity, 'critical');
  assert.match(bypass.scope, /missing plan-mode handoff/i);
  assert.match(bypass.evidenceRef, /\.ask\/runtime\/findings\/evidence\//);
});

test('invalid commit provenance creates explainable governance bypass finding', () => {
  const repoDir = setupRepo();
  const messagePath = path.join(repoDir, 'COMMIT_EDITMSG');
  fs.writeFileSync(messagePath, 'feat: ungoverned implementation\n', 'utf8');

  const checked = run(process.execPath, [askBinPath, 'commit-msg-check', messagePath], { cwd: repoDir });
  assert.equal(checked.status, 1, checked.stdout + checked.stderr);
  const checkedPayload = JSON.parse(checked.stdout);
  assert.equal(checkedPayload.findings.length, 1);

  const listed = runOrThrow(process.execPath, [askBinPath, 'architect', 'finding', 'list'], { cwd: repoDir });
  const findings = JSON.parse(listed.stdout).findings;
  const bypass = findings.find(finding => finding.metric === 'governance_bypass');
  assert.ok(bypass, JSON.stringify(findings));
  assert.match(bypass.scope, /invalid commit provenance/i);
});
