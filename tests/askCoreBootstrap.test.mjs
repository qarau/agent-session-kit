import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testDir = path.dirname(thisFilePath);
const repoRoot = path.resolve(testDir, '..');
const bootstrapPath = path.join(repoRoot, 'scripts', 'bootstrapAskCore.cjs');

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
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `status=${String(result.status)}`,
        result.stdout,
        result.stderr,
      ].join('\n')
    );
  }

  return result;
}

test('bootstrap creates ask-core and ask init scaffolds .ask control plane', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-bootstrap-'));

  runOrThrow(process.execPath, [bootstrapPath, '--target', tempRoot], { cwd: repoRoot });

  const askBinPath = path.join(tempRoot, 'ask-core', 'bin', 'ask.js');
  assert.equal(fs.existsSync(askBinPath), true, 'ask CLI entrypoint should exist');

  runOrThrow(process.execPath, [askBinPath, 'init'], {
    cwd: tempRoot,
  });

  const workContextPath = path.join(tempRoot, '.ask', 'state', 'work-context.json');
  const historyPath = path.join(tempRoot, '.ask', 'sessions', 'history.ndjson');
  assert.equal(fs.existsSync(workContextPath), true, '.ask state should be scaffolded by ask init');
  assert.equal(fs.existsSync(historyPath), true, '.ask session history should be scaffolded by ask init');
});
