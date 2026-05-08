import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { OhderLawPackEngine } from './OhderLawPackEngine.js';
import { ArchitectureScoreEngine } from './ArchitectureScoreEngine.js';
import { OhderCouplingAnalyzerEngine } from './OhderCouplingAnalyzerEngine.js';
import { OhderDurabilityValidatorEngine } from './OhderDurabilityValidatorEngine.js';
import { OhderAuthorityAnalyzerEngine } from './OhderAuthorityAnalyzerEngine.js';
import { OhderComplexityAnalyzerEngine } from './OhderComplexityAnalyzerEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNonNegativeInt(value, fallback = 0) {
  return Math.max(0, Math.floor(toNumber(value, fallback)));
}

function normalizeOhderMode(value) {
  const normalized = normalize(value).toLowerCase();
  return ['fast', 'strict', 'refactor'].includes(normalized) ? normalized : 'fast';
}

function uniqueDirs(paths = []) {
  const dirs = new Set();
  for (const filePath of paths) {
    const normalized = normalize(filePath).replace(/\\/gu, '/');
    const top = normalized.split('/').filter(Boolean)[0] || '';
    if (top) {
      dirs.add(top);
    }
  }
  return dirs.size;
}

function nowIso() {
  return new Date().toISOString();
}

export class ArchitectRuntime {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.lawPackEngine = new OhderLawPackEngine(cwd);
    this.scoreEngine = new ArchitectureScoreEngine();
    this.couplingAnalyzer = new OhderCouplingAnalyzerEngine(cwd);
    this.durabilityValidator = new OhderDurabilityValidatorEngine(cwd);
    this.authorityAnalyzer = new OhderAuthorityAnalyzerEngine(cwd);
    this.complexityAnalyzer = new OhderComplexityAnalyzerEngine(cwd);
  }

  entropyDelta(execution = {}, validation = {}) {
    const touchedFiles = Array.isArray(execution.touchedFiles) ? execution.touchedFiles : [];
    const fileCount = touchedFiles.length;
    const testsRun = Array.isArray(validation.testsRun) ? validation.testsRun.length : 0;
    const executionFailed = execution.ok !== true || toNumber(execution.exitCode, 1) !== 0;
    const validationFailed = normalize(validation.status).toLowerCase() === 'failed';
    let delta = 0;
    if (fileCount >= 12) {
      delta += 3;
    } else if (fileCount >= 7) {
      delta += 2;
    } else if (fileCount >= 4) {
      delta += 1;
    }
    if (testsRun < 1) {
      delta += 1;
    }
    if (executionFailed) {
      delta += 1;
    }
    if (validationFailed) {
      delta += 1;
    }
    return delta;
  }

  couplingDelta(execution = {}) {
    const touchedFiles = Array.isArray(execution.touchedFiles) ? execution.touchedFiles : [];
    const dirs = uniqueDirs(touchedFiles);
    if (dirs >= 5) {
      return 3;
    }
    if (dirs >= 3) {
      return 2;
    }
    if (dirs >= 2) {
      return 1;
    }
    return 0;
  }

  replayabilityRisk(state = {}, execution = {}) {
    if (state?.continuityValid !== true) {
      return 'high';
    }
    if (state?.checkpointMatchesExecution === false) {
      return 'high';
    }
    if (execution?.failOpenApplied === true) {
      return 'medium';
    }
    return 'low';
  }

  async assess({ state = {}, slice = {}, execution = {}, validation = {}, policy = {} }) {
    const enabled = policy?.architect?.enabled !== false;
    if (!enabled) {
      const disabled = {
        status: 'skipped',
        blocking: false,
        reason: 'architect runtime disabled by policy',
        sliceId: normalize(slice.id),
        entropyDelta: 0,
        couplingDelta: 0,
        replayabilityRisk: 'unknown',
        ohderMode: normalizeOhderMode(policy?.ohder?.mode),
        findings: [],
        architectureScore: this.scoreEngine.score(),
        recommendedAction: 'continue',
        updatedAt: nowIso(),
      };
      await this.store.writeJson(this.paths.architectStatus(), disabled);
      return disabled;
    }

    const entropyDelta = this.entropyDelta(execution, validation);
    const couplingAnalysis = this.couplingAnalyzer.analyze({
      touchedFiles: Array.isArray(execution.touchedFiles) ? execution.touchedFiles : [],
    });
    const durabilityAnalysis = this.durabilityValidator.analyze({
      touchedFiles: Array.isArray(execution.touchedFiles) ? execution.touchedFiles : [],
    });
    const authorityAnalysis = this.authorityAnalyzer.analyze({
      touchedFiles: Array.isArray(execution.touchedFiles) ? execution.touchedFiles : [],
    });
    const complexityAnalysis = this.complexityAnalyzer.analyze({
      touchedFiles: Array.isArray(execution.touchedFiles) ? execution.touchedFiles : [],
    });
    const couplingDelta = Math.max(this.couplingDelta(execution), toNumber(couplingAnalysis.couplingDelta, 0));
    const replayabilityRisk = this.replayabilityRisk(state, execution);
    const maxEntropy = toNonNegativeInt(policy?.architect?.max_entropy_delta, 3);
    const maxCoupling = toNonNegativeInt(policy?.architect?.max_coupling_delta, 2);
    const requireReplayability = policy?.architect?.require_replayability !== false;
    const blockOnViolation = policy?.architect?.block_on_violation !== false;
    const ohderMode = normalizeOhderMode(policy?.ohder?.mode);
    const legacyFindings = [];
    if (entropyDelta > maxEntropy) {
      legacyFindings.push(`entropy delta ${String(entropyDelta)} exceeds max ${String(maxEntropy)}`);
    }
    if (couplingDelta > maxCoupling) {
      legacyFindings.push(`coupling delta ${String(couplingDelta)} exceeds max ${String(maxCoupling)}`);
    }
    if (requireReplayability && replayabilityRisk === 'high') {
      legacyFindings.push('replayability continuity risk is high');
    }
    if (ohderMode === 'strict') {
      if (authorityAnalysis.authorityValid === false) {
        legacyFindings.push('projection authority invalid: direct governed-state write detected outside approved authority');
      }
      if (Array.isArray(couplingAnalysis.crossLayerImports) && couplingAnalysis.crossLayerImports.length > 0) {
        legacyFindings.push('layer isolation invalid: cross-layer import direction risk detected');
      }
      if (normalize(durabilityAnalysis.risk).toLowerCase() === 'high') {
        legacyFindings.push('durability integrity at risk: high durability-sensitive change detected');
      }
    }

    const loadedLawPack = await this.lawPackEngine.load();
    const lawPack = {
      ...loadedLawPack,
      laws: Array.isArray(loadedLawPack?.laws)
        ? loadedLawPack.laws.map(law => {
          if (normalize(law?.id) === 'ohder-entropy-budget') {
            return { ...law, value: maxEntropy };
          }
          if (normalize(law?.id) === 'ohder-coupling-budget') {
            return { ...law, value: maxCoupling };
          }
          if (normalize(law?.id) === 'ohder-replayability-integrity') {
            return {
              ...law,
              enabled: requireReplayability ? law?.enabled !== false : false,
              value: 'high',
            };
          }
          return law;
        })
        : [],
    };
    const lawEvaluation = this.lawPackEngine.evaluate(lawPack, {
      sessionId: normalize(state.sessionId),
      operation: normalize(slice?.execution?.operation),
      entropy_delta: entropyDelta,
      coupling_delta: couplingDelta,
      replayability_risk: replayabilityRisk,
      validation_status: normalize(validation.status).toLowerCase(),
      execution_status: normalize(execution.status).toLowerCase(),
      execution_ok: execution.ok === true ? 'true' : 'false',
      durability_risk: normalize(durabilityAnalysis.risk).toLowerCase(),
      projection_authority: authorityAnalysis.authorityValid ? 'valid' : 'invalid',
      complexity_risk: normalize(complexityAnalysis.risk).toLowerCase(),
    });
    const lawFindings = lawEvaluation.violations.map(violation => {
      const detail = normalize(violation.message)
        || `${normalize(violation.metric)} ${normalize(violation.operator)} ${String(violation.expected)}`;
      return `${normalize(violation.id)} (${normalize(violation.severity)}): ${detail}`;
    });
    const findings = [...legacyFindings, ...lawFindings];
    const violation = findings.length > 0;
    const blocking = lawEvaluation.blocking === true || (blockOnViolation && violation && lawEvaluation.outcome !== 'warn');
    const status = blocking
      ? 'failed'
      : violation
        ? lawEvaluation.outcome === 'warn'
          ? 'warning'
          : 'failed'
        : entropyDelta > 0 || couplingDelta > 0
          ? 'warning'
          : 'passed';
    const recommendedAction = blocking
      ? 'block'
      : lawEvaluation.outcome === 'retry' || status === 'failed'
        ? 'retry'
        : status === 'warning'
          ? 'continue'
          : 'continue';
    const architectureScore = this.scoreEngine.score({
      entropyDelta,
      couplingDelta,
      replayabilityRisk,
      lawEvaluation,
      couplingAnalysis,
      durabilityAnalysis,
      authorityAnalysis,
      complexityAnalysis,
    });
    const payload = {
      status,
      blocking,
      reason: violation ? findings.join('; ') : 'architecture guardrails satisfied',
      sliceId: normalize(slice.id),
      ohderMode,
      entropyDelta,
      couplingDelta,
      replayabilityRisk,
      findings,
      lawPackVersion: lawEvaluation.lawPackVersion,
      lawOutcome: lawEvaluation.outcome,
      lawViolations: lawEvaluation.violations,
      lawExemptions: lawEvaluation.exempted,
      couplingAnalysis,
      durabilityAnalysis,
      authorityAnalysis,
      complexityAnalysis,
      architectureScore,
      recommendedAction,
      updatedAt: nowIso(),
    };
    await this.store.writeJson(this.paths.architectStatus(), payload);
    return payload;
  }

  async readStatus() {
    return this.store.readJson(this.paths.architectStatus(), {
      status: 'unknown',
      blocking: false,
      entropyDelta: 0,
      couplingDelta: 0,
      replayabilityRisk: 'unknown',
      ohderMode: 'fast',
      findings: [],
      lawPackVersion: 1,
      lawOutcome: '',
      lawViolations: [],
      lawExemptions: [],
      architectureScore: this.scoreEngine.score(),
      recommendedAction: '',
      updatedAt: '',
    });
  }
}
