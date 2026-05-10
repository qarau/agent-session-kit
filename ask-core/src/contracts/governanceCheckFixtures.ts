import type {
  AskCommitMessageCheckResult,
  AskPreCommitCheckResult,
  AskPrePushCheckResult,
} from './checks.js';

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
