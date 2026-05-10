import type { AskSliceCloseFailureResult, AskSliceCloseSuccessResult } from './sliceClose.js';
import { askArchitectValidationResultFixture } from './governanceArchitectFixtures.js';
import { askPrePushCheckResultFixture } from './governanceCheckFixtures.js';

export const askSliceCloseSuccessResultFixture = {
  ok: true,
  taskId: 'slice-001',
  task: {
    taskId: 'slice-001',
    status: 'completed',
    title: 'Close slice task',
  },
  commit: {
    sha: 'abc123',
    subject: 'chore(slice): close slice-001',
    footer: 'ASK-Slice: slice-001',
    stagedFiles: ['src/slice-001.js'],
    attempts: 1,
  },
  prePush: askPrePushCheckResultFixture,
  architect: askArchitectValidationResultFixture,
  entropy: {
    entropy: {
      entropyScore: 0.1,
      trend: 'stable',
      architectureScore: 97,
      refactorPressure: 'none',
      blocking: false,
      entropyDelta: 0,
      couplingDelta: 0,
      replayabilityRisk: 'low',
      measuredAt: '2026-05-10T00:00:00.000Z',
    },
    history: {
      source: 'slice-close',
      taskId: 'slice-001',
      sliceId: 'slice-001',
      validationStatus: 'passed',
      entropyDelta: 0,
      couplingDelta: 0,
      replayabilityRisk: 'low',
      architectureScore: 97,
      entropyScore: 0.1,
    },
    driftAnalytics: {
      overall: {
        trend: 'stable',
      },
    },
    metrics: {
      latestEntropy: {
        entropyScore: 0.1,
      },
    },
  },
  lanes: ['integrator'],
  fullSuite: {
    required: true,
    command: 'npm',
    args: ['test'],
    status: 0,
  },
} satisfies AskSliceCloseSuccessResult;

export const askSliceCloseFailureResultFixture = {
  ok: false,
  taskId: 'slice-006',
  code: 'slice-close-ohder-blocked',
  message: 'OHDER architect governance blocked slice close',
  architect: {
    ...askArchitectValidationResultFixture,
    blocking: true,
  },
} satisfies AskSliceCloseFailureResult;
