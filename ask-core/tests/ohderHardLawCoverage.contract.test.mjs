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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-hard-laws-'));
}

async function scaffoldedLawPack(repoDir) {
  await new Scaffolder(repoDir).init();
  const paths = new AskPaths(repoDir);
  return new FileStore().readJson(paths.ohderLawPack(), {});
}

const hardLawCategories = [
  {
    id: 'ohder-projection-authority',
    name: 'ProjectionAuthority',
    metric: 'projection_authority',
    invalid: 'invalid',
  },
  {
    id: 'ohder-ssot-integrity',
    name: 'SSoTIntegrity',
    metric: 'ssot_integrity',
    invalid: 'invalid',
  },
  {
    id: 'ohder-replayability-integrity',
    name: 'Replayability',
    metric: 'replayability_risk',
    invalid: 'high',
  },
  {
    id: 'ohder-security-boundary',
    name: 'SecurityBoundary',
    metric: 'security_boundary',
    invalid: 'invalid',
  },
  {
    id: 'ohder-layer-isolation',
    name: 'LayerIsolation',
    metric: 'layer_isolation',
    invalid: 'invalid',
  },
  {
    id: 'ohder-event-only-sync',
    name: 'EventOnlySync',
    metric: 'event_only_sync',
    invalid: 'invalid',
  },
  {
    id: 'ohder-durability-integrity',
    name: 'DurabilityIntegrity',
    metric: 'durability_integrity',
    invalid: 'at-risk',
  },
];

const validFacts = {
  operation: 'hard-law-check',
  validation_status: 'passed',
  entropy_delta: 0,
  coupling_delta: 0,
  projection_authority: 'valid',
  ssot_integrity: 'valid',
  replayability_risk: 'low',
  security_boundary: 'valid',
  layer_isolation: 'valid',
  event_only_sync: 'valid',
  durability_integrity: 'valid',
  srp_integrity: 'strong',
};

test('scaffolded law pack includes all OHDER hard-law categories', async () => {
  const lawPack = await scaffoldedLawPack(setupRepo());
  const laws = Array.isArray(lawPack.laws) ? lawPack.laws : [];

  for (const category of hardLawCategories) {
    const law = laws.find(item => item.id === category.id);
    assert.ok(law, `missing ${category.id}`);
    assert.equal(law.name, category.name);
    assert.equal(law.lawClass, 'hard');
    assert.equal(law.outcome, 'block');
    assert.equal(law.metric, category.metric);
  }
});

test('default hard-law categories block unless exempted', async () => {
  const repoDir = setupRepo();
  const lawPack = await scaffoldedLawPack(repoDir);
  const engine = new OhderLawPackEngine(repoDir);

  for (const category of hardLawCategories) {
    const blocked = engine.evaluate(lawPack, {
      ...validFacts,
      [category.metric]: category.invalid,
    });

    assert.equal(blocked.blocking, true, `${category.id} should block`);
    assert.equal(blocked.outcome, 'block', `${category.id} should produce block outcome`);
    assert.ok(blocked.violations.find(item => item.id === category.id), `${category.id} violation missing`);
  }

  const exempted = engine.evaluate({
    ...lawPack,
    exemptions: [
      {
        lawId: 'ohder-projection-authority',
        operation: 'hard-law-check',
        reason: 'temporary projection migration',
        approvedBy: 'architecture-council',
      },
    ],
  }, {
    ...validFacts,
    projection_authority: 'invalid',
  });

  assert.equal(exempted.blocking, false);
  assert.equal(exempted.violations.length, 0);
  assert.equal(exempted.exempted[0].id, 'ohder-projection-authority');
});

test('architect runtime exposes hard-law facts in status payload', async () => {
  const repoDir = setupRepo();
  await new Scaffolder(repoDir).init();
  const status = await new ArchitectRuntime(repoDir).assess({
    state: {
      sessionId: 'sess-hard-law-facts',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-hard-law-facts',
      execution: {
        operation: 'hard-law-fact-check',
      },
    },
    execution: {
      ok: true,
      exitCode: 0,
      status: 'completed',
      touchedFiles: ['ask-core/src/core/ArchitectRuntime.js'],
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
        max_coupling_delta: 2,
        require_replayability: true,
      },
    },
  });

  for (const category of hardLawCategories) {
    assert.ok(category.metric in status.ohderFacts, `${category.metric} fact missing`);
  }
  assert.equal(status.ohderFacts.projection_authority, 'valid');
  assert.equal(status.ohderFacts.layer_isolation, 'valid');
  assert.equal(status.ohderFacts.durability_integrity, 'valid');
  assert.equal(status.blocking, false);
});
