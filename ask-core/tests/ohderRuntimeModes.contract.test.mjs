import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PolicyEngine } from '../src/core/PolicyEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-modes-'));
  fs.mkdirSync(path.join(repoDir, '.ask', 'policy'), { recursive: true });
  return repoDir;
}

function writePolicy(repoDir, text) {
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  fs.mkdirSync(path.dirname(policyPath), { recursive: true });
  fs.writeFileSync(policyPath, text, 'utf8');
}

function writeAuthorityViolation(repoDir) {
  const filePath = path.join(repoDir, 'ask-core', 'src', 'core', 'BadSnapshotWriter.js');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    "import fs from 'node:fs';\nexport function write(cwd){ fs.writeFileSync(`${cwd}/.ask/runtime/snapshots/tasks.json`, '{}', 'utf8'); }\n",
    'utf8'
  );
}

test('default policy exposes fast OHDER mode', async () => {
  const repoDir = setupRepo();
  const policy = await new PolicyEngine(repoDir).load();

  assert.equal(policy.ohder.mode, 'fast');
});

test('policy engine normalizes supported OHDER modes and falls back invalid values', async () => {
  const refactorRepo = setupRepo();
  writePolicy(refactorRepo, 'ohder:\n  mode: REFACTOR\n');

  const refactorPolicy = await new PolicyEngine(refactorRepo).load();
  assert.equal(refactorPolicy.ohder.mode, 'refactor');

  const invalidRepo = setupRepo();
  writePolicy(invalidRepo, 'ohder:\n  mode: dangerous\n');

  const invalidPolicy = await new PolicyEngine(invalidRepo).load();
  assert.equal(invalidPolicy.ohder.mode, 'fast');
});

test('architect status exposes OHDER mode', async () => {
  const repoDir = setupRepo();
  const status = await new ArchitectRuntime(repoDir).assess({
    state: {
      sessionId: 'sess-mode',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-mode',
      execution: {
        operation: 'mode-test',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles: [],
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy: {
      ohder: {
        mode: 'strict',
      },
    },
  });

  assert.equal(status.ohderMode, 'strict');
});

test('fast mode preserves warning-first behavior for analyzer authority findings', async () => {
  const repoDir = setupRepo();
  writeAuthorityViolation(repoDir);

  const status = await new ArchitectRuntime(repoDir).assess({
    state: {
      sessionId: 'sess-fast',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-fast',
      execution: {
        operation: 'fast-mode-test',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles: ['ask-core/src/core/BadSnapshotWriter.js'],
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy: {
      ohder: {
        mode: 'fast',
      },
    },
  });

  assert.equal(status.ohderMode, 'fast');
  assert.equal(status.authorityAnalysis.authorityValid, false);
  assert.equal(status.blocking, false);
});

test('strict mode blocks hard analyzer authority findings', async () => {
  const repoDir = setupRepo();
  writeAuthorityViolation(repoDir);

  const status = await new ArchitectRuntime(repoDir).assess({
    state: {
      sessionId: 'sess-strict',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-strict',
      execution: {
        operation: 'strict-mode-test',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles: ['ask-core/src/core/BadSnapshotWriter.js'],
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy: {
      ohder: {
        mode: 'strict',
      },
    },
  });

  assert.equal(status.ohderMode, 'strict');
  assert.equal(status.blocking, true);
  assert.match(status.reason, /projection authority/i);
});
