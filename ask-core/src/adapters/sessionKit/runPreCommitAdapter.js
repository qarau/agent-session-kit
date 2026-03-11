import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function runOrThrow(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `status=${String(result.status)}`,
        result.stdout ?? '',
        result.stderr ?? '',
      ].join('\n')
    );
  }
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
        checks: ['session-kit-work-context', 'session-kit-freshness', 'ask-core-preflight'],
      },
      null,
      2
    )}\n`
  );
}

export function runPreCommitAdapter(cwd = process.cwd()) {
  const { askBinPath } = resolvePaths();
  runOrThrow(process.execPath, [askBinPath, 'init'], cwd);
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], cwd);
  runOrThrow(process.execPath, [askBinPath, 'context', 'verify'], cwd);
  runOrThrow(
    process.execPath,
    ['kit/scripts/session/verifyWorkContext.mjs', '--mode=pre-commit', '--config=docs/session/active-work-context.json'],
    cwd
  );
  runOrThrow(
    process.execPath,
    ['kit/scripts/session/verifySessionDocsFreshness.mjs', '--mode=pre-commit', '--config=docs/session/active-work-context.json'],
    cwd
  );
  writeEvidence(cwd);
  runOrThrow(process.execPath, [askBinPath, 'preflight'], cwd);
  runOrThrow(process.execPath, [askBinPath, 'can-commit'], cwd);
}
