import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { OhderReplaceabilityAnalyzerEngine } from '../src/core/OhderReplaceabilityAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-replaceability-'));
  await new Scaffolder(repoDir).init();
  writeFile(repoDir, 'ask-core/src/adapters/FirebaseTaskAdapter.js', 'export class FirebaseTaskAdapter {}\n');
  writeFile(
    repoDir,
    'ask-core/src/core/LeakyRuntime.js',
    "import { FirebaseTaskAdapter } from '../adapters/FirebaseTaskAdapter.js';\nexport function makeRuntime() { return new FirebaseTaskAdapter(); }\n"
  );
  writeFile(
    repoDir,
    'ask-core/src/core/SpeculativeFactory.js',
    'export class FutureProviderFactory {}\nexport class AbstractSessionGateway {}\n'
  );
  writeFile(
    repoDir,
    'ask-core/src/core/PortableRuntime.js',
    "import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';\nexport function makeRuntime() { return new RuntimeProjectionEngine(); }\n"
  );
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: { sessionId: 'sess-replaceability', continuityValid: true, checkpointMatchesExecution: true },
    slice: { id: 'slice-replaceability', execution: { operation: 'replaceability-check' } },
    execution: { ok: true, exitCode: 0, status: 'completed', touchedFiles },
    validation: { status: 'passed', testsRun: ['unit'] },
    policy: {
      architect: { enabled: true, block_on_violation: true, max_entropy_delta: 4, max_coupling_delta: 4, require_replayability: true },
      ohder: { mode: 'strict' },
    },
  };
}

test('replaceability analyzer reports core infrastructure leakage', async () => {
  const repoDir = await setupRepo();
  const result = new OhderReplaceabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/core/LeakyRuntime.js'],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.replaceabilityValid, false);
  assert.ok(result.violations.find(item => item.kind === 'core-infrastructure-leakage'));
  assert.ok(result.violations.find(item => item.kind === 'vendor-specific-runtime-decision'));
});

test('replaceability analyzer reports speculative abstractions as warning risk', async () => {
  const repoDir = await setupRepo();
  const result = new OhderReplaceabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/core/SpeculativeFactory.js'],
  });

  assert.equal(result.risk, 'medium');
  assert.equal(result.replaceabilityValid, true);
  assert.ok(result.yagniWarnings.find(item => item.kind === 'unused-speculative-abstraction'));
});

test('replaceability analyzer allows current portable runtime dependencies', async () => {
  const repoDir = await setupRepo();
  const result = new OhderReplaceabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/core/PortableRuntime.js'],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.replaceabilityValid, true);
  assert.deepEqual(result.violations, []);
});

test('architect runtime maps replaceability and YAGNI risk into semantic facts and score', async () => {
  const repoDir = await setupRepo();
  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment(['ask-core/src/core/LeakyRuntime.js']));

  assert.equal(status.ohderFacts.replaceability_risk, 'high');
  assert.equal(status.ohderFacts.yagni_risk, 'low');
  assert.equal(status.replaceabilityAnalysis.risk, 'high');
  assert.equal(status.architectureScore.categories.replaceability < 100, true);
  assert.ok(status.semanticFacts.find(item => item.metric === 'replaceability_risk' && item.value === 'high'));
});
