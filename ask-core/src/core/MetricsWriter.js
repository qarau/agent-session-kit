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
      updatedAt: '',
    });
  }

  async write(payload) {
    await this.store.writeJson(this.paths.runtimeMetrics(), payload);
    return payload;
  }
}
