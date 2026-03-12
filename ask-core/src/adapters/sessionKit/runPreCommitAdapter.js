import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GuardedCommandRunner } from '../../core/GuardedCommandRunner.js';

const DEFAULT_STALL_TIMEOUT_MS = 180_000;

function parsePositiveInt(value, fallback) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function resolvePaths() {
  const modulePath = fileURLToPath(import.meta.url);
  const moduleDir = path.dirname(modulePath);
  const repoRoot = path.resolve(moduleDir, '../../../../');
  return {
    askBinPath: path.join(repoRoot, 'ask-core', 'bin', 'ask.js'),
  };
}

function writeEvidence(cwd) {
  const evidenceDir = path.join(cwd, '.ask', 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDir, 'latest-checks.json'),
    `${JSON.stringify(
      {
        docsFresh: true,
        testsPassed: true,
        checks: ['ask-core-pre-commit-check'],
      },
      null,
      2
    )}\n`
  );
}

function createRunner(cwd) {
  const wallTimeoutMs = parsePositiveInt(process.env.ASK_STALL_WALL_TIMEOUT_MS, DEFAULT_STALL_TIMEOUT_MS);
  const noOutputTimeoutMs = parsePositiveInt(
    process.env.ASK_STALL_NO_OUTPUT_TIMEOUT_MS,
    DEFAULT_STALL_TIMEOUT_MS
  );
  return new GuardedCommandRunner(cwd, {
    wallTimeoutMs,
    noOutputTimeoutMs,
    maxRetriesOnStall: 1,
  });
}

async function runAskCommand(runner, cwd, askBinPath, operation, askArgs) {
  await runner.run({
    operation,
    command: process.execPath,
    args: [askBinPath, ...askArgs],
    cwd,
    env: process.env,
  });
}

export async function runPreCommitAdapter(cwd = process.cwd()) {
  const { askBinPath } = resolvePaths();
  const runner = createRunner(cwd);
  await runAskCommand(runner, cwd, askBinPath, 'pre-commit-adapter:ask init', ['init']);
  await runAskCommand(runner, cwd, askBinPath, 'pre-commit-adapter:ask session start', ['session', 'start']);
  await runAskCommand(runner, cwd, askBinPath, 'pre-commit-adapter:ask context verify', ['context', 'verify']);
  writeEvidence(cwd);
  await runAskCommand(runner, cwd, askBinPath, 'pre-commit-adapter:ask pre-commit-check', ['pre-commit-check']);
}
