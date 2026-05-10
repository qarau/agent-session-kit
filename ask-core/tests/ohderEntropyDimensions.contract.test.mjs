import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { MetricsWriter } from '../src/core/MetricsWriter.js';
import { RuntimeDriftAnalyticsEngine } from '../src/core/RuntimeDriftAnalyticsEngine.js';
import { RuntimeMetricsEngine } from '../src/core/RuntimeMetricsEngine.js';
import { OhderEntropySnapshotEngine } from '../src/core/OhderEntropySnapshotEngine.js';

function setupRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-entropy-dimensions-'));
}

test('drift analytics computes expanded OHDER entropy dimension trends', () => {
  const analytics = new RuntimeDriftAnalyticsEngine().compute([
    {
      entropyDelta: 0,
      couplingDelta: 0,
      replayabilityRisk: 'low',
      behaviorReplayConfidence: 1,
      protectedFlowViolations: 0,
      hardFlowViolations: 0,
      ssotViolationCount: 0,
      durabilityRisk: 'low',
      complexityRisk: 'low',
      duplicationRisk: 'low',
      observabilityRisk: 'low',
      refactorHealth: 'healthy',
    },
    {
      entropyDelta: 1,
      couplingDelta: 1,
      replayabilityRisk: 'low',
      behaviorReplayConfidence: 1,
      protectedFlowViolations: 0,
      hardFlowViolations: 0,
      ssotViolationCount: 2,
      durabilityRisk: 'high',
      complexityRisk: 'high',
      duplicationRisk: 'medium',
      observabilityRisk: 'high',
      refactorHealth: 'regressing',
    },
  ], { windowSize: 5 });

  assert.equal(analytics.architecture.ssotViolationTrend, 'increasing');
  assert.equal(analytics.architecture.durabilityTrend, 'increasing');
  assert.equal(analytics.architecture.complexityTrend, 'increasing');
  assert.equal(analytics.architecture.duplicationTrend, 'increasing');
  assert.equal(analytics.architecture.observabilityTrend, 'increasing');
  assert.equal(analytics.architecture.refactorHealthTrend, 'increasing');
});

test('entropy snapshot surfaces expanded OHDER dimension trends', () => {
  const snapshot = new OhderEntropySnapshotEngine().snapshot({
    architect: {
      entropyDelta: 1,
      couplingDelta: 1,
      replayabilityRisk: 'low',
      status: 'warning',
      architectureScore: {
        overallScore: 86,
      },
    },
    driftAnalytics: {
      overall: {
        trend: 'regressing',
      },
      architecture: {
        couplingTrend: 'stable',
        replayabilityTrend: 'stable',
        ssotViolationTrend: 'increasing',
        durabilityTrend: 'increasing',
        complexityTrend: 'increasing',
        duplicationTrend: 'stable',
        observabilityTrend: 'stable',
        refactorHealthTrend: 'increasing',
      },
    },
  });

  assert.equal(snapshot.ssotViolationTrend, 'increasing');
  assert.equal(snapshot.durabilityTrend, 'increasing');
  assert.equal(snapshot.complexityTrend, 'increasing');
  assert.equal(snapshot.duplicationTrend, 'stable');
  assert.equal(snapshot.observabilityTrend, 'stable');
  assert.equal(snapshot.refactorHealthTrend, 'increasing');
});

test('runtime metrics history persists expanded OHDER entropy dimensions', async () => {
  const repoDir = setupRepo();
  await new Scaffolder(repoDir).init();

  await new RuntimeMetricsEngine(repoDir).capture({
    loopDurationMs: 25,
    execution: {
      touchedFiles: ['ask-core/src/core/ArchitectRuntime.js'],
      durationMs: 10,
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    recovery: {
      status: 'continue',
    },
    resumePacket: {},
    architect: {
      entropyDelta: 1,
      couplingDelta: 1,
      replayabilityRisk: 'low',
      ohderFacts: {
        ssot_integrity: 'invalid',
        durability_integrity: 'at-risk',
      },
      durabilityAnalysis: {
        risk: 'high',
      },
      complexityAnalysis: {
        risk: 'high',
      },
      architectureScore: {
        categories: {
          observability: 60,
        },
      },
      refactorOutcome: {
        status: 'regressing',
      },
    },
    flow: {},
    policy: {
      metrics: {
        drift_window_size: 5,
      },
    },
  });

  const writer = new MetricsWriter(repoDir);
  const history = await writer.readHistory();
  const latest = history.at(-1);
  const analytics = await writer.readDriftAnalytics();
  const metrics = await writer.read();

  assert.equal(latest.ssotViolationCount, 1);
  assert.equal(latest.durabilityRisk, 'high');
  assert.equal(latest.complexityRisk, 'high');
  assert.equal(latest.duplicationRisk, 'low');
  assert.equal(latest.observabilityRisk, 'high');
  assert.equal(latest.refactorHealth, 'regressing');
  assert.equal(typeof analytics.architecture.complexityTrend, 'string');
  assert.equal(typeof metrics.latestEntropyDimensions.complexityTrend, 'string');
});
