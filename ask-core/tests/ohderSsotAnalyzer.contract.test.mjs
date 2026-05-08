import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { OhderSsotAnalyzerEngine } from '../src/core/OhderSsotAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-ssot-'));
  await new Scaffolder(repoDir).init();
  writeFile(
    repoDir,
    'ask-core/src/runtime/RuntimeProjectionEngine.js',
    "export function project(store, paths, payload) { return store.writeJson(paths.taskBoardSnapshot(), payload); }\n"
  );
  writeFile(
    repoDir,
    'ask-core/src/core/DuplicateTaskSnapshotWriter.js',
    "export function duplicate(store, paths, payload) { return store.writeJson(paths.taskBoardSnapshot(), payload); }\n"
  );
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-ssot',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-ssot',
      execution: {
        operation: 'ssot-check',
      },
    },
    execution: {
      ok: true,
      exitCode: 0,
      status: 'completed',
      touchedFiles,
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy: {
      architect: {
        enabled: true,
        block_on_violation: true,
        max_entropy_delta: 3,
        max_coupling_delta: 3,
        require_replayability: true,
      },
      ohder: {
        mode: 'strict',
      },
    },
  };
}

test('SSoT analyzer allows a single approved governed-state authority', async () => {
  const repoDir = await setupRepo();
  const result = new OhderSsotAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/runtime/RuntimeProjectionEngine.js'],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.ssotValid, true);
  assert.deepEqual(result.violations, []);
});

test('SSoT analyzer reports duplicate governed-state authorities', async () => {
  const repoDir = await setupRepo();
  const result = new OhderSsotAnalyzerEngine(repoDir).analyze({
    touchedFiles: [
      'ask-core/src/runtime/RuntimeProjectionEngine.js',
      'ask-core/src/core/DuplicateTaskSnapshotWriter.js',
    ],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.ssotValid, false);
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0].target, /taskBoardSnapshot/u);
});

test('architect runtime maps duplicate authority to SSoT hard-law violation', async () => {
  const repoDir = await setupRepo();
  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment([
    'ask-core/src/runtime/RuntimeProjectionEngine.js',
    'ask-core/src/core/DuplicateTaskSnapshotWriter.js',
  ]));

  const ssotFact = status.semanticFacts.find(item => item.metric === 'ssot_integrity');

  assert.equal(status.ohderFacts.ssot_integrity, 'invalid');
  assert.equal(status.blocking, true);
  assert.ok(status.lawViolations.find(item => item.id === 'ohder-ssot-integrity'));
  assert.equal(ssotFact.value, 'invalid');
  assert.equal(ssotFact.confidence, 'high');
});
