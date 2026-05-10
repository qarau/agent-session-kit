import type { JsonObject } from './shared.js';

export interface AskCheckResult {
  passed: boolean;
  missing: string[];
  checks: string[];
  [key: string]: unknown;
}

export interface AskPreCommitCheckResult extends AskCheckResult {
  implementationPreflight?: AskCheckResult | JsonObject | null;
}

export interface AskCommitMessageCheckResult extends AskCheckResult {
  sliceFooterKey?: string;
  planFooterKey?: string;
  exemptFooterKey?: string;
  sliceIds: string[];
  planIds: string[];
  exemptKinds: string[];
  disabled?: boolean;
  findings?: JsonObject[];
}

export interface AskCheckedCommit {
  sha: string;
  sliceIds: string[];
  planIds: string[];
  exemptKinds: string[];
  files: string[];
}

export interface AskCommitGovernanceResult {
  checkedCommits: AskCheckedCommit[];
}

export interface AskPrePushCheckResult extends AskCheckResult {
  commitGovernance: AskCommitGovernanceResult;
}
