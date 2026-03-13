import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { SessionRuntime } from './SessionRuntime.js';
import { WorkContextEngine } from './WorkContextEngine.js';
import { PolicyEngine } from './PolicyEngine.js';
import { EvidenceRecorder } from './EvidenceRecorder.js';
import { normalizeBranchEnforcementMode, resolveBranchEnforcementMode } from './resolveBranchEnforcementMode.js';

const REQUIRED_DOCS = ['docs/session/current-status.md', 'docs/session/change-log.md'];
const TASKS_DOC = 'docs/session/tasks.md';

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

export class PreCommitCheckEngine {
  constructor(cwd) {
    this.cwd = cwd;
    this.sessionRuntime = new SessionRuntime(cwd);
    this.contextEngine = new WorkContextEngine(cwd);
    this.policyEngine = new PolicyEngine(cwd);
    this.evidenceRecorder = new EvidenceRecorder(cwd);
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

  getStagedFiles() {
    const raw = this.runGit(['diff', '--cached', '--name-only', '--diff-filter=ACMRT'], true);
    if (!raw) {
      return [];
    }
    return raw
      .split('\n')
      .map(normalize)
      .filter(Boolean);
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

  evaluateDocsFreshness(stagedFiles, config, branchName, branchEnforcementMode) {
    if (stagedFiles.some(file => file.startsWith('docs/ASK_Runtime/'))) {
      return false;
    }

    const meaningfulChanges = stagedFiles.filter(
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
    const hasAllRequired = requiredDocs.every(required => stagedFiles.includes(required));
    if (!hasAllRequired && resolveBranchEnforcementMode(branchName, branchEnforcementMode) === 'enforce') {
      return false;
    }
    return true;
  }

  evaluatePreflight(policy, session, context) {
    const missing = [];
    const sessionState = String(session.status || 'created').toLowerCase();
    const allowedStates = Array.isArray(policy.session?.allowed_preflight_states)
      ? policy.session.allowed_preflight_states
      : ['active', 'paused'];
    if (policy.session?.require_resume_before_edit !== false && !allowedStates.includes(sessionState)) {
      missing.push(`session state ${sessionState} not allowed for preflight`);
    }
    if (!context.branch) {
      missing.push('context verify required');
    }
    return missing;
  }

  evaluateCanCommit(policy, session, evidence) {
    const missing = [];
    const sessionState = String(session.status || 'created').toLowerCase();
    const allowedStates = Array.isArray(policy.session?.allowed_can_commit_states)
      ? policy.session.allowed_can_commit_states
      : ['active', 'paused'];

    if (policy.checks?.require_docs_freshness && !evidence.docsFresh) {
      missing.push('docs freshness');
    }
    if (policy.checks?.require_tests_before_commit && !evidence.testsPassed) {
      missing.push('tests');
    }
    if (!allowedStates.includes(sessionState)) {
      missing.push(`session state ${sessionState} not allowed for can-commit`);
    }

    return missing;
  }

  async run() {
    const checks = ['work-context', 'docs-freshness', 'session-preflight', 'session-can-commit'];
    const missing = [];
    const config = this.resolveEffectiveContextConfig(this.readConfig());
    const branchEnforcementMode = this.resolveBranchEnforcementMode(config);
    const branchName = this.runGit(['branch', '--show-current'], true);
    const stagedFiles = this.getStagedFiles();
    const policy = await this.policyEngine.load();
    const session = await this.sessionRuntime.getActiveSession();
    const context = await this.contextEngine.getContext();
    const evidence = await this.evidenceRecorder.readLatestChecks();

    if (!this.evaluateWorkContext(config)) {
      missing.push('work context mismatch for pre-commit');
    }

    if (!this.evaluateDocsFreshness(stagedFiles, config, branchName, branchEnforcementMode)) {
      missing.push('session docs freshness required');
    }

    missing.push(...this.evaluatePreflight(policy, session, context));
    missing.push(...this.evaluateCanCommit(policy, session, evidence));

    return {
      passed: missing.length === 0,
      missing: Array.from(new Set(missing)),
      checks,
    };
  }
}
