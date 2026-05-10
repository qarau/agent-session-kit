import type {
  AskOhderFinding,
  AskOhderFindingResolution,
  AskOhderSemanticFact,
} from './governance.js';
import {
  defineAskOhderFinding,
  defineAskOhderFindingResolution,
} from './governanceRuntimeBoundary.js';

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

export const askOhderFindingResolutionFixture = defineAskOhderFindingResolution({
  findingId: 'ohder-finding-example',
  decision: 'false-positive',
  reason: 'Analyzer evidence does not match the inspected runtime behavior.',
  approvedBy: 'local',
  status: 'suppressed',
} satisfies AskOhderFindingResolution);

export const askOhderFindingFixture = defineAskOhderFinding({
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
} satisfies AskOhderFinding);
