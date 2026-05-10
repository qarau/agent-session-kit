import type { IsoTimestamp, JsonObject, JsonValue } from './shared.js';

export type AskOhderRisk = 'low' | 'medium' | 'high' | 'critical' | (string & {});
export type AskOhderFindingStatus = 'open' | 'reviewing' | 'suppressed' | 'resolved' | 'exempted' | 'accepted-risk' | (string & {});
export type AskOhderFindingDecision = 'fix-planned' | 'false-positive' | 'justified-risk' | 'exempt' | 'tune-law' | 'tune-analyzer' | (string & {});

export interface AskOhderEvidenceItem {
  filePath?: string;
  reason?: string;
  lineHint?: string;
  [key: string]: JsonValue | undefined;
}

export interface AskOhderSemanticFact {
  factId: string;
  metric: string;
  value: JsonValue;
  confidence: AskOhderRisk;
  severity: AskOhderRisk;
  source: string;
  evidence: AskOhderEvidenceItem[];
  recommendations: string[];
  [key: string]: unknown;
}

export interface AskOhderLawViolation {
  id?: string;
  metric?: string;
  operator?: string;
  expected?: JsonValue;
  actual?: JsonValue;
  severity?: AskOhderRisk;
  outcome?: string;
  message?: string;
  [key: string]: unknown;
}

export interface AskOhderFindingResolution {
  findingId: string;
  decision: AskOhderFindingDecision;
  reason: string;
  approvedBy: string;
  expiresAt?: string;
  taskId?: string;
  notes?: string;
  status: AskOhderFindingStatus;
  [key: string]: unknown;
}

export interface AskOhderFindingHistoryEntry {
  ts?: IsoTimestamp;
  eventType?: string;
  resolution?: AskOhderFindingResolution;
  [key: string]: unknown;
}

export interface AskOhderFinding {
  id: string;
  status: AskOhderFindingStatus;
  severity: AskOhderRisk;
  confidence: AskOhderRisk;
  metric: string;
  analyzerId: string;
  lawId?: string;
  scope: string;
  blocking: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  evidenceRef: string;
  resolution: AskOhderFindingResolution | null;
  history: AskOhderFindingHistoryEntry[];
  semanticFact?: AskOhderSemanticFact;
  lawViolation?: AskOhderLawViolation | null;
  [key: string]: unknown;
}

export interface AskArchitectureScore {
  overallScore: number;
  grade: string;
  categories: Record<string, number>;
  weights: Record<string, number>;
  [key: string]: unknown;
}

export interface AskArchitectPerspectiveReview {
  name: string;
  status: string;
  summary: string;
  metrics: string[];
  evidenceCount: number;
  score: number;
  [key: string]: unknown;
}

export interface AskArchitectureReview {
  councilType: string;
  llmCouncilUsed: boolean;
  replayable: boolean;
  status: string;
  perspectives: AskArchitectPerspectiveReview[];
  [key: string]: unknown;
}

export interface AskArchitectValidationResult {
  status: string;
  blocking: boolean;
  reason: string;
  sliceId?: string;
  ohderMode: string;
  entropyDelta: number;
  couplingDelta: number;
  replayabilityRisk: AskOhderRisk;
  findings: string[] | AskOhderFinding[];
  lawPackVersion?: number;
  lawOutcome?: string;
  lawViolations: AskOhderLawViolation[];
  lawExemptions: JsonObject[];
  ohderFacts: Record<string, JsonValue>;
  semanticFacts: AskOhderSemanticFact[];
  architectureScore: AskArchitectureScore;
  architectureReview: AskArchitectureReview;
  recommendedAction: string;
  updatedAt: IsoTimestamp;
  [key: string]: unknown;
}

export interface AskGovernanceDecisionState {
  version?: number;
  updatedAt?: IsoTimestamp;
  status?: string;
  action?: string;
  recommendedCommand?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface AskGovernanceExplainStep {
  index?: number;
  name?: string;
  details?: JsonObject;
  [key: string]: unknown;
}

export interface AskGovernanceExplainDetails {
  decision: string;
  blocking: boolean;
  reasons: string[];
  loopId?: string;
  loopStatus?: string;
  ohderMode: string;
  modeBehavior: string;
  unresolvedBlockingFindings: AskOhderFinding[];
  acceptedRisks: AskOhderFinding[];
  temporaryExemptions: AskOhderFinding[];
  recentSuppressions: AskOhderFinding[];
  lawTuningRequests: AskOhderFinding[];
  analyzerTuningRequests: AskOhderFinding[];
  analyzerHealthWarnings: JsonObject[];
  recommendedActions: string[];
  lastStep: AskGovernanceExplainStep | null;
  steps: AskGovernanceExplainStep[];
  [key: string]: unknown;
}

export interface AskGovernanceExplainReport {
  ok: boolean;
  sessionId: string;
  ohderMode: string;
  explanation: AskGovernanceExplainDetails;
  [key: string]: unknown;
}
