import type {
  AskGovernanceDecisionState,
  AskGovernanceExplainReport,
  AskOhderFinding,
} from './governance.js';
import type { JsonObject, JsonValue } from './shared.js';

export interface AskGovernanceReportBuilderState {
  sessionId?: string;
  status?: string;
  nextRecommendedAction?: string;
  ohderMode?: string;
  continuityValid?: boolean;
  dirtyWorktree?: boolean;
  architect?: JsonObject;
  flow?: JsonObject;
  loop?: JsonObject;
  governanceDecision?: AskGovernanceDecisionState | JsonObject;
  ohderFindings?: {
    version?: number;
    findings?: Record<string, AskOhderFinding | JsonObject>;
    [key: string]: JsonValue | Record<string, AskOhderFinding | JsonObject> | undefined;
  };
  [key: string]: unknown;
}

export interface AskGovernanceStatusReport {
  ok: boolean;
  sessionId: string;
  runtimeStatus: string;
  nextRecommendedAction: string;
  ohderMode: string;
  continuityValid: boolean;
  dirtyWorktree: boolean;
  architect: JsonObject;
  flow: JsonObject;
  loop: JsonObject;
  governanceDecision: AskGovernanceDecisionState | JsonObject;
  ohderFindings: JsonObject;
  [key: string]: unknown;
}

export interface AskGovernanceReportBuilderOutput {
  status: AskGovernanceStatusReport;
  explain: AskGovernanceExplainReport;
}

export const AskGovernanceReportBuilderFixture = {
  status: {
    ok: true,
    sessionId: 'sess-governance-builder',
    runtimeStatus: 'active',
    nextRecommendedAction: 'ask next',
    ohderMode: 'fast',
    continuityValid: true,
    dirtyWorktree: false,
    architect: {},
    flow: {},
    loop: {},
    governanceDecision: {
      decision: 'continue',
      recommendedCommand: 'ask next',
    },
    ohderFindings: {
      version: 1,
      findings: {},
    },
  },
  explain: {
    ok: true,
    sessionId: 'sess-governance-builder',
    ohderMode: 'fast',
    explanation: {
      decision: 'continue',
      blocking: false,
      reasons: [],
      loopId: '',
      loopStatus: '',
      ohderMode: 'fast',
      modeBehavior: 'fast mode surfaces OHDER warnings quickly while preserving warning-first development flow',
      unresolvedBlockingFindings: [],
      acceptedRisks: [],
      temporaryExemptions: [],
      recentSuppressions: [],
      lawTuningRequests: [],
      analyzerTuningRequests: [],
      analyzerHealthWarnings: [],
      recommendedActions: ['ask next'],
      lastStep: null,
      steps: [],
    },
  },
} satisfies AskGovernanceReportBuilderOutput;
