import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { OhderObservabilityAnalyzerEngine } from '../src/core/OhderObservabilityAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';
import { RuntimeMetricsEngine } from '../src/core/RuntimeMetricsEngine.js';
import { MetricsWriter } from '../src/core/MetricsWriter.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-observability-'));
  await new Scaffolder(repoDir).init();
  writeFile(
    repoDir,
    'ask-core/src/core/SilentBlockRuntime.js',
    `export function closeSlice(policy) {
  if (policy.blocked) {
    return { ok: false };
  }
  return { ok: true };
}
`
  );
  writeFile(
    repoDir,
    'ask-core/src/core/SilentGovernanceMutationRuntime.js',
    `export async function mutateGovernance(store, paths, payload) {
  await store.writeJson(paths.governanceDecision(), payload);
  return { ok: true, status: 'updated' };
}
`
  );
  writeFile(
    repoDir,
    'ask-core/src/core/ObservableRuntime.js',
    `export async function closeSlice(events, payload) {
  if (payload.blocked) {
    await events.appendEvent({ type: 'GovernanceGateBlocked', payload });
    return { ok: false, code: 'governance-blocked', message: 'governance blocked this slice' };
  }
  await events.appendEvent({ type: 'GovernanceDecisionRecorded', payload });
  return { ok: true, status: 'updated', message: 'governance state recorded' };
}
`
  );
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-observability',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-observability',
      execution: {
        operation: 'observability-check',
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

test('observability analyzer reports blocking runtime paths without diagnostics', async () => {
  const repoDir = await setupRepo();
  const result = new OhderObservabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/core/SilentBlockRuntime.js'],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.observabilityValid, false);
  assert.equal(result.violations.length, 1);
  assert.match(result.violations[0].reason, /without diagnostic code or message/u);
});

test('observability analyzer reports governance mutation without event emission', async () => {
  const repoDir = await setupRepo();
  const result = new OhderObservabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/core/SilentGovernanceMutationRuntime.js'],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.observabilityValid, false);
  assert.ok(result.violations.find(item => item.kind === 'governance-mutation-without-event'));
});

test('observability analyzer allows event-backed diagnostic-rich runtime changes', async () => {
  const repoDir = await setupRepo();
  const result = new OhderObservabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/core/ObservableRuntime.js'],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.observabilityValid, true);
  assert.deepEqual(result.violations, []);
});

test('architect runtime maps observability risk into score and entropy history', async () => {
  const repoDir = await setupRepo();
  const touchedFiles = ['ask-core/src/core/SilentBlockRuntime.js'];
  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment(touchedFiles));

  assert.equal(status.ohderFacts.observability_risk, 'high');
  assert.equal(status.observabilityAnalysis.risk, 'high');
  assert.equal(status.architectureScore.categories.observability < 100, true);
  assert.ok(status.semanticFacts.find(item => item.metric === 'observability_risk' && item.value === 'high'));

  await new RuntimeMetricsEngine(repoDir).capture({
    loopDurationMs: 25,
    execution: { touchedFiles: [], durationMs: 5 },
    validation: { status: 'passed', testsRun: ['unit'] },
    recovery: { status: 'continue' },
    resumePacket: {},
    architect: { observabilityAnalysis: { risk: 'low' } },
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
  assert.equal(history.at(-1).observabilityRisk, 'high');
  assert.equal(metrics.latestEntropyDimensions.observabilityTrend, 'increasing');
});
