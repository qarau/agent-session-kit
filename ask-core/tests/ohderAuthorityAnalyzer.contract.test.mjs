import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OhderAuthorityAnalyzerEngine } from '../src/core/OhderAuthorityAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-authority-'));
  fs.mkdirSync(path.join(repoDir, 'ask-core', 'src', 'runtime'), { recursive: true });
  fs.mkdirSync(path.join(repoDir, 'ask-core', 'src', 'core'), { recursive: true });
  fs.writeFileSync(
    path.join(repoDir, 'ask-core', 'src', 'runtime', 'RuntimeSnapshotStore.js'),
    "export async function writeSession(store, paths, payload){ await store.writeJson(paths.sessionSnapshot(), payload); }\n",
    'utf8'
  );
  fs.writeFileSync(
    path.join(repoDir, 'ask-core', 'src', 'core', 'BadSnapshotWriter.js'),
    "import fs from 'node:fs';\nexport function write(cwd){ fs.writeFileSync(`${cwd}/.ask/runtime/snapshots/tasks.json`, '{}', 'utf8'); }\n",
    'utf8'
  );
  return repoDir;
}

test('authority analyzer allows approved snapshot authority writes', () => {
  const repoDir = setupRepo();
  const engine = new OhderAuthorityAnalyzerEngine(repoDir);

  const result = engine.analyze({
    touchedFiles: ['ask-core/src/runtime/RuntimeSnapshotStore.js'],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.authorityValid, true);
  assert.deepEqual(result.violations, []);
  assert.equal(result.approvedAuthorities.length, 1);
});

test('authority analyzer reports direct governed state writes outside authorities', () => {
  const repoDir = setupRepo();
  const engine = new OhderAuthorityAnalyzerEngine(repoDir);

  const result = engine.analyze({
    touchedFiles: ['ask-core/src/core/BadSnapshotWriter.js'],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.authorityValid, false);
  assert.equal(result.violations.length, 1);
  assert.match(result.findings[0], /direct write to governed ASK runtime state/u);
});

test('architect runtime exposes authority analysis and SSoT score penalty', async () => {
  const repoDir = setupRepo();
  const runtime = new ArchitectRuntime(repoDir);

  const status = await runtime.assess({
    state: {
      sessionId: 'sess-authority',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-authority',
      execution: {
        operation: 'authority-test',
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
      testsRun: ['node --test'],
    },
    policy: {
      architect: {
        block_on_violation: false,
      },
    },
  });

  assert.equal(status.authorityAnalysis.violations.length, 1);
  assert.equal(status.authorityAnalysis.authorityValid, false);
  assert.equal(status.architectureScore.categories.ssotIntegrity < 100, true);
});
