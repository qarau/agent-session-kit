import { MetricsWriter } from './MetricsWriter.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class RuntimeMetricsEngine {
  constructor(cwd) {
    this.writer = new MetricsWriter(cwd);
  }

  async capture({ loopDurationMs, execution, validation, recovery, resumePacket }) {
    const previous = await this.writer.read();
    const loopsRun = toNumber(previous.loopsRun, 0) + 1;
    const failures = toNumber(previous.failureEvents, 0) + (validation?.status === 'failed' ? 1 : 0);
    const passes = toNumber(previous.passEvents, 0) + (validation?.status === 'passed' ? 1 : 0);

    const payload = {
      ...previous,
      loopsRun,
      sessionDurationMs: toNumber(previous.sessionDurationMs, 0) + toNumber(loopDurationMs, 0),
      sliceDurationMs: toNumber(loopDurationMs, 0),
      executionDurationMs: toNumber(execution?.durationMs, 0),
      checkpointDurationMs: 0,
      validationPassRate: loopsRun > 0 ? Number((passes / loopsRun).toFixed(4)) : 0,
      failureRecoveryRate: loopsRun > 0
        ? Number(((recovery?.status === 'retry' ? 1 : 0) / loopsRun).toFixed(4))
        : 0,
      contextRecoveryCost: toNumber(resumePacket?.contextRecoveryCost?.estimatedTokens, 0),
      filesTouchedPerSlice: Array.isArray(execution?.touchedFiles) ? execution.touchedFiles.length : 0,
      commandsRunPerSlice: Array.isArray(validation?.testsRun) ? validation.testsRun.length : 0,
      retryCount: toNumber(previous.retryCount, 0) + (recovery?.status === 'retry' ? 1 : 0),
      blockedCount: toNumber(previous.blockedCount, 0) + (recovery?.status === 'block' ? 1 : 0),
      policyOverrideCount: toNumber(previous.policyOverrideCount, 0) + (execution?.failOpenApplied ? 1 : 0),
      failureEvents: failures,
      passEvents: passes,
      updatedAt: new Date().toISOString(),
    };
    await this.writer.write(payload);
    return payload;
  }
}
