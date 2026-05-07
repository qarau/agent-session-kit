import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SessionRuntime } from './SessionRuntime.js';
import { WorkContextEngine } from './WorkContextEngine.js';
import { PolicyEngine } from './PolicyEngine.js';
import { EvidenceRecorder } from './EvidenceRecorder.js';
import { CodexGovernanceParityEngine } from './CodexGovernanceParityEngine.js';
import { ReleaseDocsConsistencyEngine } from './ReleaseDocsConsistencyEngine.js';
import { normalizeBranchEnforcementMode, resolveBranchEnforcementMode } from './resolveBranchEnforcementMode.js';
import { evaluateCanCommitGate, evaluatePreflightGate } from './sessionPolicyGates.js';

const REQUIRED_DOCS = ['docs/session/current-status.md', 'docs/session/change-log.md'];
const TASKS_DOC = 'docs/session/tasks.md';
const GOVERNANCE_MODE_MAINTAINER = 'maintainer';
const GOVERNANCE_MODE_PROJECT = 'project';

function normalize(pathValue) {
  return pathValue.replaceAll('\\', '/').trim();
}

function parseBoolean(value, fallback) {
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }
  const normalized = value.toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  return fallback;
}

function normalizeGovernanceMode(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === GOVERNANCE_MODE_MAINTAINER || normalized === GOVERNANCE_MODE_PROJECT) {
    return normalized;
  }
  return '';
}

function parseList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map(entry => normalize(entry).toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(entry => normalize(entry).toLowerCase()).filter(Boolean);
  }
  return [...fallback];
}

export class PrePushCheckEngine {
  constructor(cwd) {
    this.cwd = cwd;
    this.sessionRuntime = new SessionRuntime(cwd);
    this.contextEngine = new WorkContextEngine(cwd);
    this.policyEngine = new PolicyEngine(cwd);
    this.evidenceRecorder = new EvidenceRecorder(cwd);
    this.codexParityEngine = new CodexGovernanceParityEngine(cwd);
    this.releaseDocsEngine = new ReleaseDocsConsistencyEngine();
  }

  runGit(args, allowFailure = false) {
    try {
      return execFileSync('git', args, { cwd: this.cwd, encoding: 'utf8' }).trim();
    } catch {
      if (allowFailure) {
        return '';
      }
      throw new Error(`git ${args.join(' ')} failed`);
    }
  }

  readConfig() {
    const configPath = path.join(this.cwd, 'docs', 'session', 'active-work-context.json');
    if (!fs.existsSync(configPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  readRepoWorkContextLock() {
    const enabledRaw = this.runGit(['config', '--get', 'session.workContextLock.enabled'], true);
    const expectedBranch = this.runGit(['config', '--get', 'session.workContextLock.expectedBranch'], true);
    const expectedRepoPathSuffix = this.runGit(
      ['config', '--get', 'session.workContextLock.expectedRepoPathSuffix'],
      true
    );
    const enforceRepoPathSuffixRaw = this.runGit(
      ['config', '--get', 'session.workContextLock.enforceRepoPathSuffix'],
      true
    );

    const hasAnyValue =
      enabledRaw.length > 0 ||
      expectedBranch.length > 0 ||
      expectedRepoPathSuffix.length > 0 ||
      enforceRepoPathSuffixRaw.length > 0;
    const enabled = parseBoolean(enabledRaw, false) || (enabledRaw.length === 0 && hasAnyValue);
    if (!enabled) {
      return { enabled: false };
    }
    return {
      enabled: true,
      expectedBranch,
      expectedRepoPathSuffix,
      enforceRepoPathSuffix: parseBoolean(enforceRepoPathSuffixRaw, false),
    };
  }

  resolveEffectiveContextConfig(fileConfig) {
    const repoLock = this.readRepoWorkContextLock();
    if (!repoLock.enabled) {
      return fileConfig;
    }
    return {
      ...fileConfig,
      expectedBranch: repoLock.expectedBranch,
      expectedRepoPathSuffix: repoLock.expectedRepoPathSuffix,
      enforceRepoPathSuffix: repoLock.enforceRepoPathSuffix,
    };
  }

  evaluateWorkContext(config) {
    const expectedBranch = config.expectedBranch;
    if (!expectedBranch || typeof expectedBranch !== 'string') {
      return false;
    }

    const runtimeBranch = this.runGit(['branch', '--show-current'], true);
    if (runtimeBranch !== expectedBranch) {
      return false;
    }

    if (config.enforceRepoPathSuffix === true) {
      const expectedRepoPathSuffix = config.expectedRepoPathSuffix;
      if (!expectedRepoPathSuffix || typeof expectedRepoPathSuffix !== 'string') {
        return false;
      }
      const repoTopLevel = this.runGit(['rev-parse', '--show-toplevel'], true);
      if (!normalize(repoTopLevel).endsWith(normalize(expectedRepoPathSuffix))) {
        return false;
      }
    }

    return true;
  }

  getConfiguredUpstream() {
    return this.runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], true);
  }

  resolveNoUpstreamBase() {
    const candidates = ['origin/main', 'main', 'origin/master', 'master'];
    for (const candidate of candidates) {
      const exists = this.runGit(['rev-parse', '--verify', `${candidate}^{commit}`], true);
      if (!exists) {
        continue;
      }
      const mergeBase = this.runGit(['merge-base', candidate, 'HEAD'], true);
      if (mergeBase) {
        return mergeBase;
      }
    }
    return '';
  }

  getOutgoingRange() {
    const upstream = this.getConfiguredUpstream();
    if (upstream) {
      return {
        mode: 'upstream',
        range: `${upstream}..HEAD`,
      };
    }

    const headExists = this.runGit(['rev-parse', '--verify', 'HEAD'], true);
    if (!headExists) {
      return {
        mode: 'empty',
        range: '',
      };
    }

    const base = this.resolveNoUpstreamBase();
    if (base) {
      return {
        mode: 'base',
        range: `${base}..HEAD`,
      };
    }

    return {
      mode: 'all-head',
      range: 'HEAD',
    };
  }

  getOutgoingFiles() {
    const outgoing = this.getOutgoingRange();
    if (outgoing.mode === 'empty') {
      return [];
    }
    if (outgoing.mode === 'all-head') {
      const commits = this.getOutgoingCommits();
      const files = new Set();
      for (const commit of commits) {
        for (const file of this.getCommitFiles(commit)) {
          files.add(file);
        }
      }
      return Array.from(files).sort();
    }
    return this.parseFileList(this.runGit(['diff', '--name-only', '--diff-filter=ACMRT', outgoing.range], true));
  }

  parseFileList(raw) {
    if (!raw) {
      return [];
    }
    return raw
      .split('\n')
      .map(normalize)
      .filter(Boolean);
  }

  getOutgoingCommits() {
    const outgoing = this.getOutgoingRange();
    if (outgoing.mode === 'empty') {
      return [];
    }
    if (outgoing.mode === 'all-head') {
      return this.parseFileList(this.runGit(['rev-list', '--reverse', 'HEAD'], true));
    }
    return this.parseFileList(this.runGit(['rev-list', '--reverse', outgoing.range], true));
  }

  getCommitMessage(commitSha) {
    return this.runGit(['log', '-1', '--pretty=%B', commitSha], true);
  }

  getCommitFiles(commitSha) {
    const raw = this.runGit(['show', '--name-only', '--pretty=format:', commitSha], true);
    return this.parseFileList(raw);
  }

  parseSliceCommitFooters(message, sliceFooterKey, exemptFooterKey) {
    const text = String(message ?? '');
    const slicePattern = new RegExp(`^\\s*${sliceFooterKey}:\\s*(\\S+)\\s*$`, 'gmi');
    const exemptPattern = new RegExp(`^\\s*${exemptFooterKey}:\\s*(\\S+)\\s*$`, 'gmi');
    const sliceIds = [];
    const exemptKinds = [];

    for (const match of text.matchAll(slicePattern)) {
      sliceIds.push(normalize(match[1]));
    }
    for (const match of text.matchAll(exemptPattern)) {
      exemptKinds.push(normalize(match[1]).toLowerCase());
    }

    return { sliceIds, exemptKinds };
  }

  isExemptionScopeValid(files, allowedPrefixes, allowedExactFiles) {
    if (!Array.isArray(files) || files.length === 0) {
      return false;
    }
    for (const file of files) {
      const normalized = normalize(file).toLowerCase();
      if (!normalized) {
        continue;
      }
      if (allowedExactFiles.has(normalized)) {
        continue;
      }
      if (allowedPrefixes.some(prefix => normalized.startsWith(prefix))) {
        continue;
      }
      return false;
    }
    return true;
  }

  evaluateSliceCommitGovernance(policy = {}) {
    const section = policy.slice_commit ?? {};
    const enabled = section.enabled !== false;
    if (!enabled) {
      return { missing: [], checkedCommits: [] };
    }

    const sliceFooterKey = normalize(section.footer_key) || 'ASK-Slice';
    const exemptFooterKey = normalize(section.exempt_footer_key) || 'ASK-Exempt';
    const allowedExemptions = new Set(parseList(section.allowed_exemptions, ['release', 'meta']));
    const allowedExemptPrefixes = parseList(section.exempt_allowed_path_prefixes, [
      'docs/releases/',
      'docs/session/',
    ]);
    const allowedExemptExactFiles = new Set(
      parseList(section.exempt_allowed_exact_files, [
        'CHANGELOG.md',
        'README.md',
        'package.json',
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',
      ])
    );

    const commits = this.getOutgoingCommits();
    const missing = [];
    const seenSliceIds = new Map();
    const checkedCommits = [];

    for (const sha of commits) {
      const message = this.getCommitMessage(sha);
      const files = this.getCommitFiles(sha);
      const { sliceIds, exemptKinds } = this.parseSliceCommitFooters(message, sliceFooterKey, exemptFooterKey);
      checkedCommits.push({
        sha,
        sliceIds,
        exemptKinds,
        files,
      });

      if (sliceIds.length > 1) {
        missing.push(`commit ${sha} has multiple ${sliceFooterKey} footers`);
        continue;
      }

      if (sliceIds.length > 0 && exemptKinds.length > 0) {
        missing.push(`commit ${sha} cannot include both ${sliceFooterKey} and ${exemptFooterKey}`);
        continue;
      }

      if (sliceIds.length === 1) {
        const sliceId = sliceIds[0];
        if (!sliceId) {
          missing.push(`commit ${sha} has invalid ${sliceFooterKey} value`);
          continue;
        }
        if (seenSliceIds.has(sliceId)) {
          missing.push(`slice id ${sliceId} appears in multiple outgoing commits`);
          continue;
        }
        seenSliceIds.set(sliceId, sha);
        continue;
      }

      if (exemptKinds.length > 1) {
        missing.push(`commit ${sha} has multiple ${exemptFooterKey} footers`);
        continue;
      }
      if (exemptKinds.length === 1) {
        const kind = exemptKinds[0];
        if (!allowedExemptions.has(kind)) {
          missing.push(`commit ${sha} has invalid ${exemptFooterKey} value: ${kind}`);
          continue;
        }
        if (!this.isExemptionScopeValid(files, allowedExemptPrefixes, allowedExemptExactFiles)) {
          missing.push(`commit ${sha} exemption ${kind} has non-release/meta file changes`);
        }
        continue;
      }

      missing.push(`commit ${sha} missing ${sliceFooterKey} footer or ${exemptFooterKey} exemption`);
    }

    return {
      missing,
      checkedCommits,
    };
  }

  isTasksStrict(config) {
    if (process.env.SESSION_TASKS_STRICT === '1') {
      return true;
    }
    return config.strictTasksDoc === true;
  }

  resolveBranchEnforcementMode(config) {
    const modeFromEnv = normalizeBranchEnforcementMode(process.env.ASK_BRANCH_ENFORCEMENT_MODE);
    if (modeFromEnv) {
      return modeFromEnv;
    }
    const modeFromConfig = normalizeBranchEnforcementMode(config.branchEnforcementMode);
    if (modeFromConfig) {
      return modeFromConfig;
    }
    return 'protected';
  }

  evaluateDocsFreshness(files, config, branchName, branchEnforcementMode) {
    if (files.some(file => file.startsWith('docs/ASK_Runtime/'))) {
      return false;
    }

    const meaningfulChanges = files.filter(
      file =>
        !file.startsWith('docs/session/') &&
        !file.startsWith('scripts/session/') &&
        !file.startsWith('.githooks/')
    );
    if (meaningfulChanges.length === 0) {
      return true;
    }

    const strictTasksDoc = this.isTasksStrict(config);
    const requiredDocs = strictTasksDoc ? [...REQUIRED_DOCS, TASKS_DOC] : [...REQUIRED_DOCS];
    const hasAllRequired = requiredDocs.every(required => files.includes(required));
    if (!hasAllRequired && resolveBranchEnforcementMode(branchName, branchEnforcementMode) === 'enforce') {
      return false;
    }
    return true;
  }

  evaluateReleaseDocs(branchName, branchEnforcementMode) {
    const errors = this.releaseDocsEngine.verify(this.cwd);
    if (errors.length === 0) {
      return true;
    }
    return resolveBranchEnforcementMode(branchName, branchEnforcementMode) !== 'enforce';
  }

  resolveGovernanceMode(config) {
    const modeFromEnv = normalizeGovernanceMode(process.env.ASK_GOVERNANCE_MODE);
    if (modeFromEnv) {
      return modeFromEnv;
    }
    const modeFromConfig = normalizeGovernanceMode(config.governanceMode);
    if (modeFromConfig) {
      return modeFromConfig;
    }
    return GOVERNANCE_MODE_PROJECT;
  }

  async run() {
    const checks = ['work-context', 'docs-freshness', 'codex-governance-parity', 'slice-commit-governance'];
    const missing = [];
    const config = this.resolveEffectiveContextConfig(this.readConfig());
    const governanceMode = this.resolveGovernanceMode(config);
    const branchEnforcementMode = this.resolveBranchEnforcementMode(config);
    const branchName = this.runGit(['branch', '--show-current'], true);
    const outgoingFiles = this.getOutgoingFiles();
    const policy = await this.policyEngine.load();
    const session = await this.sessionRuntime.getActiveSession();
    const context = await this.contextEngine.getContext();
    const evidence = await this.evidenceRecorder.readLatestChecks();

    if (!this.evaluateWorkContext(config)) {
      missing.push('work context mismatch for pre-push');
    }

    if (!this.evaluateDocsFreshness(outgoingFiles, config, branchName, branchEnforcementMode)) {
      missing.push('session docs freshness required');
    }

    const codexParity = this.codexParityEngine.evaluate({
      policy,
      sessionId: session.sessionId,
    });
    missing.push(...codexParity.missing);

    const sliceCommitGovernance = this.evaluateSliceCommitGovernance(policy);
    missing.push(...sliceCommitGovernance.missing);

    if (governanceMode === GOVERNANCE_MODE_MAINTAINER) {
      checks.push('release-docs');
      if (!this.evaluateReleaseDocs(branchName, branchEnforcementMode)) {
        missing.push('release docs consistency required');
      }
    }

    checks.push('session-preflight', 'session-can-commit');
    missing.push(...evaluatePreflightGate(policy, session, context).missing);
    missing.push(...evaluateCanCommitGate(policy, session, evidence).missing);

    return {
      passed: missing.length === 0,
      missing: Array.from(new Set(missing)),
      checks,
      commitGovernance: {
        checkedCommits: sliceCommitGovernance.checkedCommits,
      },
    };
  }
}
