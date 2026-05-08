import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { OhderDuplicationAnalyzerEngine } from '../src/core/OhderDuplicationAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';
import { RuntimeMetricsEngine } from '../src/core/RuntimeMetricsEngine.js';
import { MetricsWriter } from '../src/core/MetricsWriter.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-duplication-'));
  await new Scaffolder(repoDir).init();
  const duplicateBlock = `
export function normalizeTaskInput(input = {}) {
  const title = String(input.title ?? '').trim();
  const owner = String(input.owner ?? '').trim();
  const status = String(input.status ?? 'created').trim().toLowerCase();
  const dependencies = Array.isArray(input.dependencies) ? input.dependencies.filter(Boolean) : [];
  const acceptanceCriteria = Array.isArray(input.acceptanceCriteria) ? input.acceptanceCriteria.filter(Boolean) : [];
  if (!title) {
    throw new Error('title is required');
  }
  return { title, owner, status, dependencies, acceptanceCriteria };
}
`;
  writeFile(repoDir, 'ask-core/src/core/TaskNormalizer.js', duplicateBlock);
  writeFile(repoDir, 'ask-core/src/runtime/TaskInputNormalizer.js', duplicateBlock);
  writeFile(
    repoDir,
    'ask-core/src/core/BoilerplateOnly.js',
    `import fs from 'node:fs';
import path from 'node:path';

export const CREATED = 'created';
export const COMPLETED = 'completed';
export class EmptyRuntime {}
`
  );
  writeFile(
    repoDir,
    'ask-core/src/runtime/BoilerplateMirror.js',
    `import fs from 'node:fs';
import path from 'node:path';

export const CREATED = 'created';
export const COMPLETED = 'completed';
export class EmptyRuntime {}
`
  );
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-duplication',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-duplication',
      execution: {
        operation: 'duplication-check',
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
        max_entropy_delta: 4,
        max_coupling_delta: 4,
        require_replayability: true,
      },
      ohder: {
        mode: 'strict',
      },
      metrics: {
        drift_window_size: 5,
      },
    },
  };
}

test('duplication analyzer reports meaningful duplicated logic with file evidence', async () => {
  const repoDir = await setupRepo();
  const result = new OhderDuplicationAnalyzerEngine(repoDir).analyze({
    touchedFiles: [
      'ask-core/src/core/TaskNormalizer.js',
      'ask-core/src/runtime/TaskInputNormalizer.js',
    ],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.duplicationValid, false);
  assert.equal(result.duplicateGroups.length, 1);
  assert.deepEqual(result.duplicateGroups[0].files.sort(), [
    'ask-core/src/core/TaskNormalizer.js',
    'ask-core/src/runtime/TaskInputNormalizer.js',
  ].sort());
  assert.match(result.findings[0], /duplicated logic/u);
});

test('duplication analyzer ignores import and constant boilerplate mirrors', async () => {
  const repoDir = await setupRepo();
  const result = new OhderDuplicationAnalyzerEngine(repoDir).analyze({
    touchedFiles: [
      'ask-core/src/core/BoilerplateOnly.js',
      'ask-core/src/runtime/BoilerplateMirror.js',
    ],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.duplicationValid, true);
  assert.deepEqual(result.duplicateGroups, []);
});

test('architect runtime maps duplication into score and entropy history', async () => {
  const repoDir = await setupRepo();
  const touchedFiles = [
    'ask-core/src/core/TaskNormalizer.js',
    'ask-core/src/runtime/TaskInputNormalizer.js',
  ];
  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment(touchedFiles));

  assert.equal(status.ohderFacts.duplication_risk, 'high');
  assert.equal(status.duplicationAnalysis.risk, 'high');
  assert.equal(status.architectureScore.categories.replaceability < 100, true);
  assert.ok(status.semanticFacts.find(item => item.metric === 'duplication_risk' && item.value === 'high'));

  await new RuntimeMetricsEngine(repoDir).capture({
    loopDurationMs: 25,
    execution: { touchedFiles: [], durationMs: 5 },
    validation: { status: 'passed', testsRun: ['unit'] },
    recovery: { status: 'continue' },
    resumePacket: {},
    architect: { duplicationAnalysis: { risk: 'low' } },
    flow: {},
    policy: { metrics: { drift_window_size: 5 } },
  });
  const metrics = await new RuntimeMetricsEngine(repoDir).capture({
    loopDurationMs: 25,
    execution: { touchedFiles, durationMs: 5 },
    validation: { status: 'passed', testsRun: ['unit'] },
    recovery: { status: 'continue' },
    resumePacket: {},
    architect: status,
    flow: {},
    policy: { metrics: { drift_window_size: 5 } },
  });

  const history = await new MetricsWriter(repoDir).readHistory();
  assert.equal(history.at(-1).duplicationRisk, 'high');
  assert.equal(metrics.latestEntropyDimensions.duplicationTrend, 'increasing');
});
