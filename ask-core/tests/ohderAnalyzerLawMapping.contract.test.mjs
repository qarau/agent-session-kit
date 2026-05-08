import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-law-map-'));
  return repoDir;
}

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function scaffoldRepo() {
  const repoDir = setupRepo();
  await new Scaffolder(repoDir).init();
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-law-map',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-law-map',
      execution: {
        operation: 'law-map-check',
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

function complexSource() {
  const branches = Array.from({ length: 30 }, (_, index) => `if (value === ${String(index)}) { console.log(value); }\n`).join('');
  const filler = Array.from({ length: 260 }, (_, index) => `const policyProjectionScoreLine${String(index)} = ${String(index)};\n`).join('');
  return `import fs from 'node:fs';\nexport function mixed(value) {\nconst policy = 'policy';\nconst projection = 'projection';\nconst score = 'score';\n${branches}${filler}return fs.existsSync(String(value)) && Boolean(policy || projection || score);\n}\n`;
}

test('hard analyzer findings produce law-pack violations', async () => {
  const repoDir = await scaffoldRepo();
  writeFile(repoDir, 'ask-core/src/core/BadCore.js', "import '../cli/index.js';\nexport const badCore = true;\n");
  writeFile(
    repoDir,
    'ask-core/src/core/BadSnapshotWriter.js',
    "import fs from 'node:fs';\nexport function write(cwd){ fs.writeFileSync(`${cwd}/.ask/runtime/snapshots/tasks.json`, '{}', 'utf8'); }\n"
  );

  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment([
    'ask-core/src/core/BadCore.js',
    'ask-core/src/core/BadSnapshotWriter.js',
    'ask-core/src/runtime/projectors/FooProjector.js',
    'ask-core/src/runtime/EventLedger.js',
    'ask-core/src/core/schemaMigration.js',
  ]));

  assert.equal(status.ohderFacts.projection_authority, 'invalid');
  assert.equal(status.ohderFacts.layer_isolation, 'invalid');
  assert.equal(status.ohderFacts.durability_integrity, 'at-risk');
  assert.equal(status.blocking, true);
  assert.ok(status.lawViolations.find(item => item.id === 'ohder-projection-authority'));
  assert.ok(status.lawViolations.find(item => item.id === 'ohder-layer-isolation'));
  assert.ok(status.lawViolations.find(item => item.id === 'ohder-durability-integrity'));
});

test('high complexity maps to soft SRP law without blocking fast mode', async () => {
  const repoDir = await scaffoldRepo();
  writeFile(repoDir, 'ask-core/src/core/LargeMixed.js', complexSource());

  const status = await new ArchitectRuntime(repoDir).assess({
    ...baseAssessment(['ask-core/src/core/LargeMixed.js']),
    policy: {
      ...baseAssessment([]).policy,
      ohder: {
        mode: 'fast',
      },
    },
  });

  const srpViolation = status.lawViolations.find(item => item.id === 'ohder-srp-integrity');

  assert.equal(status.ohderFacts.srp_integrity, 'weak');
  assert.ok(srpViolation);
  assert.equal(srpViolation.lawClass, 'soft');
  assert.equal(srpViolation.outcome, 'warn');
  assert.equal(status.blocking, false);
});
