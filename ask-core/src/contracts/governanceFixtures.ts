import type {
  AskCommitMessageCheckResult,
  AskPreCommitCheckResult,
  AskPrePushCheckResult,
} from './checks.js';
import type {
  AskArchitectValidationResult,
  AskGovernanceDecisionState,
  AskOhderFinding,
  AskOhderFindingResolution,
  AskOhderSemanticFact,
} from './governance.js';

export const askPreCommitCheckResultFixture = {
  passed: true,
  missing: [],
  checks: ['work-context', 'docs-freshness', 'codex-governance-parity', 'session-preflight', 'session-can-commit'],
  implementationPreflight: null,
} satisfies AskPreCommitCheckResult;

export const askCommitMessageCheckResultFixture = {
  passed: true,
  missing: [],
  checks: ['commit-message-provenance'],
  sliceFooterKey: 'ASK-Slice',
  planFooterKey: 'ASK-Plan',
  exemptFooterKey: 'ASK-Exempt',
  sliceIds: ['ask-ts-005'],
  planIds: [],
  exemptKinds: [],
  findings: [],
} satisfies AskCommitMessageCheckResult;

export const askPrePushCheckResultFixture = {
  passed: true,
  missing: [],
  checks: ['work-context', 'docs-freshness', 'codex-governance-parity', 'slice-commit-governance', 'session-preflight', 'session-can-commit'],
  commitGovernance: {
    checkedCommits: [
      {
        sha: '0000000000000000000000000000000000000000',
        sliceIds: ['ask-ts-005'],
        planIds: [],
        exemptKinds: [],
        files: ['ask-core/src/contracts/checks.ts'],
      },
    ],
  },
} satisfies AskPrePushCheckResult;

export const askOhderSemanticFactFixture = {
  factId: 'durability-integrity',
  metric: 'durability_integrity',
  value: 'valid',
  confidence: 'low',
  severity: 'low',
  source: 'OhderDurabilityValidatorEngine',
  evidence: [],
  recommendations: [],
} satisfies AskOhderSemanticFact;

export const askOhderFindingResolutionFixture = {
  findingId: 'ohder-finding-example',
  decision: 'false-positive',
  reason: 'Analyzer evidence does not match the inspected runtime behavior.',
  approvedBy: 'local',
  status: 'suppressed',
} satisfies AskOhderFindingResolution;

export const askOhderFindingFixture = {
  id: 'ohder-finding-example',
  status: 'suppressed',
  severity: 'low',
  confidence: 'low',
  metric: 'durability_integrity',
  analyzerId: 'OhderDurabilityValidatorEngine',
  lawId: '',
  scope: 'runtime',
  blocking: false,
  createdAt: '2026-05-09T00:00:00.000Z',
  updatedAt: '2026-05-09T00:00:00.000Z',
  evidenceRef: '.ask/runtime/findings/evidence/ohder-finding-example.json',
  resolution: askOhderFindingResolutionFixture,
  history: [],
  semanticFact: askOhderSemanticFactFixture,
  lawViolation: null,
} satisfies AskOhderFinding;

export const askArchitectValidationResultFixture = {
  status: 'warning',
  blocking: false,
  reason: 'architecture guardrails satisfied',
  sliceId: 'ask-ts-005',
  ohderMode: 'fast',
  entropyDelta: 1,
  couplingDelta: 0,
  replayabilityRisk: 'low',
  findings: [],
  lawPackVersion: 1,
  lawOutcome: 'allow',
  lawViolations: [],
  lawExemptions: [],
  ohderFacts: {
    durability_integrity: 'valid',
    replayability_risk: 'low',
  },
  semanticFacts: [askOhderSemanticFactFixture],
  architectureScore: {
    overallScore: 99,
    grade: 'A',
    categories: {
      durability: 99,
    },
    weights: {
      durability: 15,
    },
  },
  architectureReview: {
    councilType: 'council-lite',
    llmCouncilUsed: false,
    replayable: true,
    status: 'clear',
    perspectives: [
      {
        name: 'durability',
        status: 'clear',
        summary: 'durability has no high-confidence blocking fact',
        metrics: ['durability_integrity'],
        evidenceCount: 0,
        score: 99,
      },
    ],
  },
  recommendedAction: 'continue',
  updatedAt: '2026-05-09T00:00:00.000Z',
} satisfies AskArchitectValidationResult;

export const askGovernanceDecisionStateFixture = {
  version: 1,
  updatedAt: '2026-05-09T00:00:00.000Z',
  status: 'continue',
  action: 'continue',
  recommendedCommand: 'ask next',
  reason: 'governance state allows continuation',
} satisfies AskGovernanceDecisionState;
