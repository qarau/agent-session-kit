import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { FileStore } from '../src/fs/FileStore.js';
import { AskPaths } from '../src/fs/AskPaths.js';
import { OhderLawPackEngine } from '../src/core/OhderLawPackEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function setupRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-'));
}

test('OHDER law pack evaluates violations and exemptions with deterministic outcome', async () => {
  const repoDir = setupRepo();
  const scaffolder = new Scaffolder(repoDir);
  await scaffolder.init();
  const store = new FileStore();
  const paths = new AskPaths(repoDir);

  await store.writeJson(paths.ohderLawPack(), {
    version: 1,
    defaultOutcomes: {
      critical: 'block',
      high: 'retry',
      medium: 'warn',
      low: 'warn',
    },
    laws: [
      {
        id: 'law-critical',
        severity: 'critical',
        enabled: true,
        metric: 'replayability_risk',
        operator: '!=',
        value: 'high',
      },
    ],
    exemptions: [
      {
        lawId: 'law-critical',
        operation: 'exempted-operation',
        reason: 'temporary exception',
        approvedBy: 'arch-review',
      },
    ],
  });

  const engine = new OhderLawPackEngine(repoDir);
  const lawPack = await engine.load();
  const blocked = engine.evaluate(lawPack, {
    operation: 'default-operation',
    replayability_risk: 'high',
  });
  assert.equal(blocked.blocking, true);
  assert.equal(blocked.outcome, 'block');
  assert.equal(blocked.violations.length, 1);

  const exempted = engine.evaluate(lawPack, {
    operation: 'exempted-operation',
    replayability_risk: 'high',
  });
  assert.equal(exempted.blocking, false);
  assert.equal(exempted.violations.length, 0);
  assert.equal(exempted.exempted.length, 1);
});

test('Architect runtime applies OHDER laws and emits governance-ready status payload', async () => {
  const repoDir = setupRepo();
  const scaffolder = new Scaffolder(repoDir);
  await scaffolder.init();
  const runtime = new ArchitectRuntime(repoDir);
  const payload = await runtime.assess({
    state: {
      sessionId: 'sess_ohder_001',
      continuityValid: false,
      checkpointMatchesExecution: false,
    },
    slice: {
      id: 'slice_ohder_001',
      execution: {
        operation: 'architect-law-check',
      },
    },
    execution: {
      ok: false,
      exitCode: 1,
      status: 'failed',
      touchedFiles: ['src/a.js', 'src/b.js', 'src/c.js', 'src/d.js'],
    },
    validation: {
      status: 'failed',
      testsRun: [],
    },
    policy: {
      architect: {
        enabled: true,
        block_on_violation: true,
        max_entropy_delta: 3,
        max_coupling_delta: 2,
        require_replayability: true,
      },
    },
  });

  assert.equal(payload.status, 'failed');
  assert.equal(payload.blocking, true);
  assert.equal(typeof payload.lawPackVersion, 'number');
  assert.equal(Array.isArray(payload.lawViolations), true);
  assert.equal(payload.lawViolations.length > 0, true);
  assert.equal(typeof payload.lawOutcome, 'string');
});
