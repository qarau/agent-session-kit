import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OhderCouplingAnalyzerEngine } from '../src/core/OhderCouplingAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-coupling-'));
  fs.mkdirSync(path.join(repoDir, 'ask-core', 'src', 'core'), { recursive: true });
  fs.mkdirSync(path.join(repoDir, 'ask-core', 'src', 'cli', 'commands'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'ask-core', 'src', 'core', 'DomainRuntime.js'), 'export const domain = true;\n', 'utf8');
  fs.writeFileSync(path.join(repoDir, 'ask-core', 'src', 'core', 'BadCore.js'), "import { runNext } from '../cli/commands/next.js';\nexport const bad = runNext;\n", 'utf8');
  fs.writeFileSync(path.join(repoDir, 'ask-core', 'src', 'cli', 'commands', 'next.js'), "import { domain } from '../../core/DomainRuntime.js';\nexport function runNext(){ return domain; }\n", 'utf8');
  return repoDir;
}

test('coupling analyzer keeps same-layer changes low risk', () => {
  const repoDir = setupRepo();
  const engine = new OhderCouplingAnalyzerEngine(repoDir);

  const result = engine.analyze({
    touchedFiles: ['ask-core/src/core/DomainRuntime.js'],
  });

  assert.equal(result.couplingDelta, 0);
  assert.equal(result.risk, 'low');
  assert.deepEqual(result.crossLayerImports, []);
  assert.equal(result.touchedLayers.core, 1);
});

test('coupling analyzer flags core to cli import direction risk', () => {
  const repoDir = setupRepo();
  const engine = new OhderCouplingAnalyzerEngine(repoDir);

  const result = engine.analyze({
    touchedFiles: ['ask-core/src/core/BadCore.js'],
  });

  assert.equal(result.risk, 'medium');
  assert.equal(result.couplingDelta >= 1, true);
  assert.equal(result.crossLayerImports.length, 1);
  assert.equal(result.crossLayerImports[0].fromLayer, 'core');
  assert.equal(result.crossLayerImports[0].toLayer, 'cli');
  assert.match(result.findings[0], /core imports cli/u);
});

test('architect runtime exposes coupling analysis and score penalty', async () => {
  const repoDir = setupRepo();
  const architect = new ArchitectRuntime(repoDir);

  const status = await architect.assess({
    state: {
      sessionId: 'sess-test',
      continuityValid: true,
    },
    slice: {
      id: 'slice-coupling',
      execution: {
        operation: 'coupling-test',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles: ['ask-core/src/core/BadCore.js'],
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

  assert.equal(status.couplingAnalysis.crossLayerImports.length, 1);
  assert.equal(status.couplingDelta >= 1, true);
  assert.equal(status.architectureScore.categories.layerDiscipline < 100, true);
});

test('architect runtime treats root tooling files as one coupling boundary', () => {
  const repoDir = setupRepo();
  const architect = new ArchitectRuntime(repoDir);

  const delta = architect.couplingDelta({
    touchedFiles: [
      '.gitignore',
      'package.json',
      'package-lock.json',
      'tsconfig.json',
      'ask-core/src/contracts/index.ts',
    ],
  });

  assert.equal(delta, 1);
});
