import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

export class MetricsWriter {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async read() {
    return this.store.readJson(this.paths.runtimeMetrics(), {
      sessionDurationMs: 0,
      sliceDurationMs: 0,
      executionDurationMs: 0,
      checkpointDurationMs: 0,
      validationPassRate: 0,
      failureRecoveryRate: 0,
      contextRecoveryCost: 0,
      filesTouchedPerSlice: 0,
      commandsRunPerSlice: 0,
      retryCount: 0,
      blockedCount: 0,
      policyOverrideCount: 0,
      loopsRun: 0,
      architectureDriftScore: 0,
      behaviorDriftScore: 0,
      driftTrend: 'stable',
      driftWindowSize: 0,
      latestEntropyDimensions: {
        ssotViolationTrend: 'stable',
        durabilityTrend: 'stable',
        complexityTrend: 'stable',
        duplicationTrend: 'stable',
        observabilityTrend: 'stable',
        refactorHealthTrend: 'stable',
      },
      updatedAt: '',
    });
  }

  async write(payload) {
    await this.store.writeJson(this.paths.runtimeMetrics(), payload);
    return payload;
  }

  async appendHistory(entry) {
    await this.store.appendLine(this.paths.runtimeMetricsHistory(), JSON.stringify(entry));
    return entry;
  }

  async readHistory() {
    const lines = await this.store.readLines(this.paths.runtimeMetricsHistory(), []);
    return lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  async readDriftAnalytics() {
    return this.store.readJson(this.paths.runtimeDriftAnalytics(), {
      windowSize: 0,
      architecture: {
        entropyTrend: 'stable',
        couplingTrend: 'stable',
        replayabilityTrend: 'stable',
        ssotViolationTrend: 'stable',
        durabilityTrend: 'stable',
        complexityTrend: 'stable',
        duplicationTrend: 'stable',
        observabilityTrend: 'stable',
        refactorHealthTrend: 'stable',
        driftScore: 0,
      },
      behavior: {
        replayConfidenceTrend: 'stable',
        protectedViolationTrend: 'stable',
        hardViolationTrend: 'stable',
        driftScore: 0,
      },
      overall: {
        trend: 'stable',
        driftScore: 0,
      },
      updatedAt: '',
    });
  }

  async writeDriftAnalytics(payload) {
    await this.store.writeJson(this.paths.runtimeDriftAnalytics(), payload);
    return payload;
  }
}
