import type {
  AskGovernanceDecisionState,
  AskGovernanceExplainReport,
} from './governance.js';
import { askOhderFindingFixture } from './governanceOhderFixtures.js';

export const askGovernanceDecisionStateFixture = {
  version: 1,
  updatedAt: '2026-05-09T00:00:00.000Z',
  status: 'continue',
  action: 'continue',
  recommendedCommand: 'ask next',
  reason: 'governance state allows continuation',
} satisfies AskGovernanceDecisionState;

export const askGovernanceExplainReportFixture = {
  ok: true,
  sessionId: 'sess-governance-explain',
  ohderMode: 'fast',
  explanation: {
    decision: 'continue',
    blocking: false,
    reasons: ['governance state allows continuation'],
    loopId: 'loop-governance-explain',
    loopStatus: 'completed',
    ohderMode: 'fast',
    modeBehavior: 'fast mode surfaces OHDER warnings quickly while preserving warning-first development flow',
    unresolvedBlockingFindings: [],
    acceptedRisks: [],
    temporaryExemptions: [],
    recentSuppressions: [askOhderFindingFixture],
    lawTuningRequests: [],
    analyzerTuningRequests: [],
    analyzerHealthWarnings: [
      {
        analyzerId: 'OhderSecurityBoundaryAnalyzerEngine',
        warning: 'requires review when evidence is security-sensitive',
      },
    ],
    recommendedActions: ['ask architect finding list', 'ask next'],
    lastStep: {
      index: 15,
      name: 'Decide Continue / Retry / Block / Close',
      details: {
        decision: 'continue',
      },
    },
    steps: [
      {
        index: 1,
        name: 'Hydrate Runtime State',
        details: {
          status: 'completed',
        },
      },
      {
        index: 15,
        name: 'Decide Continue / Retry / Block / Close',
        details: {
          decision: 'continue',
        },
      },
    ],
  },
} satisfies AskGovernanceExplainReport;
