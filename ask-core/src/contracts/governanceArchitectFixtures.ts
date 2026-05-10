import type {
  AskArchitectValidationResult,
} from './governance.js';
import { askOhderSemanticFactFixture } from './governanceOhderFixtures.js';

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
