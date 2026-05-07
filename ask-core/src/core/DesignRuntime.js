import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { DesignDiscoveryEngine } from './DesignDiscoveryEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
}

function matchPattern(filePath, pattern) {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedPattern = normalizePath(pattern);
  if (!normalizedPattern) {
    return false;
  }
  if (!normalizedPattern.includes('*')) {
    return normalizedFilePath === normalizedPattern || normalizedFilePath.endsWith(`/${normalizedPattern}`);
  }
  const token = '__ASK_GLOBSTAR__';
  const prepared = escapeRegex(normalizedPattern)
    .replace(/\*\*/gu, token)
    .replace(/\*/gu, '[^/]*')
    .replace(new RegExp(token, 'gu'), '.*');
  const regex = new RegExp(`^${prepared}$`, 'u');
  return regex.test(normalizedFilePath) || regex.test(normalizedFilePath.replace(/^\.?\//u, ''));
}

function hasOwnObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function defaultStatus() {
  return {
    status: 'unknown',
    blocking: false,
    reason: '',
    sliceId: '',
    impactedRegions: [],
    warnings: [],
    metrics: {
      visualDriftTrend: 'stable',
      protectedDesignViolations: 0,
      componentFragmentationRate: 0,
      modalConsistencyScore: 1,
      spacingRhythmScore: 1,
      uxAestheticScore: 1,
      brandConsistencyScore: 1,
      validationRuns: 0,
      updatedAt: '',
    },
    updatedAt: '',
  };
}

function defaultMetrics() {
  return {
    visualDriftTrend: 'stable',
    protectedDesignViolations: 0,
    componentFragmentationRate: 0,
    modalConsistencyScore: 1,
    spacingRhythmScore: 1,
    uxAestheticScore: 1,
    brandConsistencyScore: 1,
    validationRuns: 0,
    updatedAt: '',
  };
}

const DESIGN_STAGES = ['exploratory', 'emerging', 'guided', 'standardized', 'protected'];

function normalizeDesignStage(value) {
  const normalized = normalize(value).toLowerCase();
  if (DESIGN_STAGES.includes(normalized)) {
    return normalized;
  }
  if (normalized === 'standard' || normalized === 'stable') {
    return 'standardized';
  }
  if (normalized === 'guarded') {
    return 'protected';
  }
  return 'exploratory';
}

function stageRank(value) {
  const index = DESIGN_STAGES.indexOf(normalizeDesignStage(value));
  return index < 0 ? 0 : index;
}

function canPromote(fromStage, toStage) {
  return stageRank(toStage) === stageRank(fromStage) + 1;
}

function summarizeStageCounts(visualMap = {}) {
  const counts = {
    exploratory: 0,
    emerging: 0,
    guided: 0,
    standardized: 0,
    protected: 0,
  };
  for (const region of Object.values(visualMap)) {
    const stage = normalizeDesignStage(region?.status);
    counts[stage] = (counts[stage] || 0) + 1;
  }
  return counts;
}

function isProtectedRegion(region = {}) {
  const status = normalizeDesignStage(region.status);
  if (status === 'protected' || status === 'standardized') {
    return true;
  }
  const protectedRules = Array.isArray(region.protectedRules) ? region.protectedRules : [];
  return protectedRules.length > 0;
}

function affectedModal(touchedFiles = [], impactedRegions = []) {
  const touchedModal = touchedFiles.some(filePath => normalize(filePath).toLowerCase().includes('modal'));
  const impactedModal = impactedRegions.some(region => normalize(region.id).toLowerCase().includes('modal'));
  return touchedModal || impactedModal;
}

export class DesignRuntime {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.discovery = new DesignDiscoveryEngine();
  }

  async readDesignSystemDoc() {
    return this.store.readText(this.paths.designSystemDoc(), '# Design System Memory\n');
  }

  async readDesignTokens() {
    return this.store.readJson(this.paths.designTokens(), {});
  }

  async readComponentPatterns() {
    return this.store.readJson(this.paths.componentPatterns(), {});
  }

  async readModalContracts() {
    return this.store.readJson(this.paths.modalContracts(), {});
  }

  async readVisualRegressionMap() {
    return this.store.readJson(this.paths.visualRegressionMap(), {});
  }

  async readMetrics() {
    return this.store.readJson(this.paths.designMetrics(), defaultMetrics());
  }

  async writeMetrics(payload = {}) {
    await this.store.writeJson(this.paths.designMetrics(), payload);
  }

  async writeStatus(payload = {}) {
    await this.store.writeJson(this.paths.designStatus(), payload);
  }

  async appendHistory(entry = {}) {
    await this.store.appendLine(this.paths.designHistory(), JSON.stringify(entry));
  }

  async list() {
    const designSystem = await this.readDesignSystemDoc();
    const tokens = await this.readDesignTokens();
    const patterns = await this.readComponentPatterns();
    const modalContracts = await this.readModalContracts();
    const visualMap = await this.readVisualRegressionMap();
    const metrics = await this.readMetrics();
    return {
      designSystemLength: designSystem.length,
      tokenGroups: Object.keys(tokens),
      componentPatternCount: Object.keys(patterns).length,
      modalContractCount: Object.keys(modalContracts).length,
      visualRegionCount: Object.keys(visualMap).length,
      stageCounts: summarizeStageCounts(visualMap),
      visualRegions: Object.entries(visualMap).map(([id, region]) => ({
        id,
        status: normalizeDesignStage(region?.status),
        protectedRules: Array.isArray(region?.protectedRules) ? region.protectedRules.length : 0,
        filePatterns: Array.isArray(region?.files) ? region.files.length : 0,
      })),
      metrics,
    };
  }

  validatePromotionGovernance({ fromStage, toStage, reason, approvedBy, approvalTicket, policy = {} }) {
    const normalizedReason = normalize(reason);
    const normalizedApprovedBy = normalize(approvedBy);
    const normalizedApprovalTicket = normalize(approvalTicket);
    const requireReason = policy?.design?.require_promotion_reason !== false;
    const reasonMinLength = toNumber(policy?.design?.promotion_reason_min_length, 10);
    if (requireReason && normalizedReason.length < reasonMinLength) {
      return {
        ok: false,
        code: 'invalid-promotion-reason',
        message: `promotion reason must be at least ${String(reasonMinLength)} characters`,
      };
    }

    const target = normalizeDesignStage(toStage);
    const needsStandardizedApproval = target === 'standardized' && policy?.design?.require_approval_for_standardized === true;
    const needsStandardizedTicket = target === 'standardized' && policy?.design?.require_approval_ticket_for_standardized === true;
    const needsProtectedApproval = target === 'protected' && policy?.design?.require_approval_for_protected === true;
    const needsProtectedTicket = target === 'protected' && policy?.design?.require_approval_ticket_for_protected === true;

    if ((needsStandardizedApproval || needsProtectedApproval) && !normalizedApprovedBy) {
      return {
        ok: false,
        code: 'missing-promotion-approval',
        message: `promotion from ${normalizeDesignStage(fromStage)} to ${target} requires --approved-by`,
      };
    }
    if ((needsStandardizedTicket || needsProtectedTicket) && !normalizedApprovalTicket) {
      return {
        ok: false,
        code: 'missing-promotion-approval-ticket',
        message: `promotion from ${normalizeDesignStage(fromStage)} to ${target} requires --approval-ticket`,
      };
    }
    return {
      ok: true,
      reason: normalizedReason,
      approvedBy: normalizedApprovedBy,
      approvalTicket: normalizedApprovalTicket,
    };
  }

  async promoteRegion({ regionId, toStage, reason, approvedBy, approvalTicket, policy = {} }) {
    const id = normalize(regionId);
    if (!id) {
      return {
        ok: false,
        code: 'missing-region-id',
        message: 'region id is required',
      };
    }
    const targetStage = normalizeDesignStage(toStage);
    if (!DESIGN_STAGES.includes(targetStage)) {
      return {
        ok: false,
        code: 'invalid-target-stage',
        message: `target stage must be one of ${DESIGN_STAGES.join(', ')}`,
      };
    }

    const visualMap = await this.readVisualRegressionMap();
    const region = visualMap[id];
    if (!region) {
      return {
        ok: false,
        code: 'region-not-found',
        message: `design region not found: ${id}`,
      };
    }
    const fromStage = normalizeDesignStage(region.status);
    if (fromStage === targetStage) {
      return {
        ok: false,
        code: 'noop-promotion',
        message: `design region ${id} is already in stage ${targetStage}`,
      };
    }
    if (!canPromote(fromStage, targetStage)) {
      return {
        ok: false,
        code: 'invalid-stage-transition',
        message: `invalid lifecycle transition ${fromStage} -> ${targetStage}; promotions must be sequential`,
      };
    }

    const governance = this.validatePromotionGovernance({
      fromStage,
      toStage: targetStage,
      reason,
      approvedBy,
      approvalTicket,
      policy,
    });
    if (!governance.ok) {
      return governance;
    }

    const promotedAt = nowIso();
    visualMap[id] = {
      ...region,
      status: targetStage,
      lifecycle: {
        ...(hasOwnObject(region.lifecycle) ? region.lifecycle : {}),
        promotedFrom: fromStage,
        promotedTo: targetStage,
        promotedAt,
        promotedBy: governance.approvedBy,
        approvalTicket: governance.approvalTicket,
        reason: governance.reason,
      },
    };
    await this.store.writeJson(this.paths.visualRegressionMap(), visualMap);

    const patterns = await this.readComponentPatterns();
    if (patterns[id] && hasOwnObject(patterns[id])) {
      patterns[id] = {
        ...patterns[id],
        status: targetStage,
        promotedAt,
      };
      await this.store.writeJson(this.paths.componentPatterns(), patterns);
    }

    await this.appendHistory({
      type: 'DesignPatternPromoted',
      ts: promotedAt,
      regionId: id,
      from: fromStage,
      to: targetStage,
      reason: governance.reason,
      approvedBy: governance.approvedBy,
      approvalTicket: governance.approvalTicket,
    });
    return {
      ok: true,
      summary: {
        regionId: id,
        from: fromStage,
        to: targetStage,
      },
      stageCounts: summarizeStageCounts(visualMap),
      region: {
        id,
        ...visualMap[id],
      },
    };
  }

  async discoverFromLast({ slice = {}, execution = {}, validation = {}, policy = {} }) {
    const visualMap = await this.readVisualRegressionMap();
    const patterns = await this.readComponentPatterns();
    const result = this.discovery.discoverFromEvidence({
      visualMap,
      execution,
      validation,
      policy,
    });
    const discoveredAt = nowIso();

    if (result.discovered.length < 1) {
      const payload = {
        ok: true,
        status: 'noop',
        reason: result.reason,
        sliceId: normalize(slice.id),
        discoveredCount: 0,
        examinedFiles: result.examinedFiles,
        skippedMappedFiles: result.skippedMappedFiles,
        discoveredRegions: [],
      };
      await this.appendHistory({
        type: 'DesignDiscoveryRun',
        ts: discoveredAt,
        sliceId: payload.sliceId,
        status: 'noop',
        reason: payload.reason,
        discoveredCount: 0,
      });
      return payload;
    }

    const nextVisualMap = { ...visualMap };
    const nextPatterns = { ...patterns };
    const discoveredRegions = [];
    for (const region of result.discovered) {
      nextVisualMap[region.id] = {
        files: [...region.files],
        protectedRules: [...region.protectedRules],
        status: region.status,
      };
      nextPatterns[region.id] = {
        sourceFile: region.sourceFile,
        status: region.status,
        discoveredAt,
      };
      discoveredRegions.push({
        id: region.id,
        name: region.name,
        status: region.status,
        sourceFile: region.sourceFile,
      });
      await this.appendHistory({
        type: 'DesignFlowDiscovered',
        ts: discoveredAt,
        sliceId: normalize(slice.id),
        regionId: region.id,
        sourceFile: region.sourceFile,
        status: region.status,
      });
    }
    await this.store.writeJson(this.paths.visualRegressionMap(), nextVisualMap);
    await this.store.writeJson(this.paths.componentPatterns(), nextPatterns);
    await this.appendHistory({
      type: 'DesignDiscoveryRun',
      ts: discoveredAt,
      sliceId: normalize(slice.id),
      status: 'discovered',
      reason: result.reason,
      discoveredCount: discoveredRegions.length,
    });
    return {
      ok: true,
      status: 'discovered',
      reason: result.reason,
      sliceId: normalize(slice.id),
      discoveredCount: discoveredRegions.length,
      examinedFiles: result.examinedFiles,
      skippedMappedFiles: result.skippedMappedFiles,
      discoveredRegions,
    };
  }

  impactedRegions(visualMap = {}, touchedFiles = []) {
    const normalizedTouched = touchedFiles.map(value => normalizePath(value)).filter(Boolean);
    return Object.entries(visualMap)
      .filter(([, region]) => {
        const files = Array.isArray(region?.files) ? region.files : [];
        return files.some(pattern => normalizedTouched.some(filePath => matchPattern(filePath, pattern)));
      })
      .map(([id, region]) => ({
        id,
        status: normalizeDesignStage(region?.status),
        protectedRules: Array.isArray(region?.protectedRules) ? [...region.protectedRules] : [],
      }));
  }

  buildWarnings({ touchedFiles, impactedRegions, tokens, patterns, modalContracts, execution, validation }) {
    const warnings = [];
    const tokenMissing = !hasOwnObject(tokens) || !hasOwnObject(tokens.colors) || !hasOwnObject(tokens.spacing) || !hasOwnObject(tokens.typography);
    if (impactedRegions.length > 0 && tokenMissing) {
      warnings.push({
        code: 'design-token-authority-missing',
        severity: 'warning',
        detail: 'design tokens are incomplete for impacted visual regions',
      });
    }

    if (impactedRegions.length > 0 && Object.keys(patterns || {}).length < 1) {
      warnings.push({
        code: 'component-patterns-missing',
        severity: 'warning',
        detail: 'component patterns missing for impacted visual regions',
      });
    }

    if (affectedModal(touchedFiles, impactedRegions) && Object.keys(modalContracts || {}).length < 1) {
      warnings.push({
        code: 'modal-contracts-missing',
        severity: 'warning',
        detail: 'modal files changed but modal contracts are not defined',
      });
    }

    const hasRuntimeFailure = execution.ok !== true || normalize(validation.status).toLowerCase() === 'failed';
    if (hasRuntimeFailure) {
      for (const region of impactedRegions) {
        if (!isProtectedRegion(region)) {
          continue;
        }
        warnings.push({
          code: 'protected-design-risk',
          severity: 'warning',
          regionId: region.id,
          detail: 'protected visual region changed during failed execution/validation',
        });
      }
    }
    return warnings;
  }

  nextMetrics(previous, impactedRegions, warnings) {
    const validationRuns = toNumber(previous.validationRuns, 0) + 1;
    const protectedWarnings = warnings.filter(item => item.code === 'protected-design-risk').length;
    const protectedDesignViolations = toNumber(previous.protectedDesignViolations, 0) + protectedWarnings;
    const fragmentationWarnings = warnings.filter(item => item.code === 'component-patterns-missing').length;
    const tokenWarnings = warnings.filter(item => item.code === 'design-token-authority-missing').length;
    const modalWarnings = warnings.filter(item => item.code === 'modal-contracts-missing').length;
    const regionCount = impactedRegions.length;
    const componentFragmentationRate = regionCount > 0
      ? Number((fragmentationWarnings / regionCount).toFixed(4))
      : 0;
    const warningCount = warnings.length;
    const visualDriftTrend = warningCount > 0 ? 'regressing' : 'stable';
    const modalConsistencyScore = modalWarnings > 0 ? 0.65 : 1;
    const spacingRhythmScore = tokenWarnings > 0 ? 0.7 : 1;
    const uxAestheticScore = Number(Math.max(0, 1 - Math.min(0.6, warningCount * 0.1)).toFixed(4));
    const brandConsistencyScore = Number(Math.max(0, 1 - Math.min(0.7, (protectedWarnings * 0.2) + (tokenWarnings * 0.1))).toFixed(4));
    return {
      visualDriftTrend,
      protectedDesignViolations,
      componentFragmentationRate,
      modalConsistencyScore,
      spacingRhythmScore,
      uxAestheticScore,
      brandConsistencyScore,
      validationRuns,
      updatedAt: nowIso(),
    };
  }

  async validateFromLast({ slice = {}, execution = {}, validation = {}, policy = {} }) {
    const enabled = policy?.design?.enabled !== false;
    if (!enabled) {
      const payload = {
        ...defaultStatus(),
        status: 'skipped',
        reason: 'design runtime disabled by policy',
        sliceId: normalize(slice.id),
        updatedAt: nowIso(),
      };
      await this.writeStatus(payload);
      return payload;
    }

    const tokens = await this.readDesignTokens();
    const patterns = await this.readComponentPatterns();
    const modalContracts = await this.readModalContracts();
    const visualMap = await this.readVisualRegressionMap();
    const previousMetrics = await this.readMetrics();
    const touchedFiles = Array.isArray(execution.touchedFiles) ? execution.touchedFiles : [];
    const impactedRegions = this.impactedRegions(visualMap, touchedFiles);
    const warnings = this.buildWarnings({
      touchedFiles,
      impactedRegions,
      tokens,
      patterns,
      modalContracts,
      execution,
      validation,
    });
    const metrics = this.nextMetrics(previousMetrics, impactedRegions, warnings);
    await this.writeMetrics(metrics);

    const warnOnly = policy?.design?.warn_only !== false;
    const blocking = warnOnly ? false : (policy?.design?.block_on_protected_violation === true && warnings.some(item => item.code === 'protected-design-risk'));
    const status = warnings.length > 0 ? 'warning' : 'passed';
    const payload = {
      status,
      blocking,
      reason: warnings.length > 0 ? 'design warnings detected' : 'design validation passed',
      sliceId: normalize(slice.id),
      impactedRegions,
      warnings,
      metrics,
      updatedAt: nowIso(),
    };
    await this.writeStatus(payload);
    await this.appendHistory({
      type: 'DesignValidationRun',
      ts: nowIso(),
      sliceId: normalize(slice.id),
      status,
      impactedRegionCount: impactedRegions.length,
      warningCount: warnings.length,
      protectedWarningCount: warnings.filter(item => item.code === 'protected-design-risk').length,
    });
    if (warnings.length > 0) {
      await this.appendHistory({
        type: 'DesignDriftDetected',
        ts: nowIso(),
        sliceId: normalize(slice.id),
        warningCount: warnings.length,
        driftTrend: metrics.visualDriftTrend,
      });
    }
    return payload;
  }

  async status() {
    const stored = await this.store.readJson(this.paths.designStatus(), defaultStatus());
    const metrics = await this.readMetrics();
    const summary = await this.list();
    return {
      ...stored,
      metrics,
      visualRegionCount: summary.visualRegionCount,
      componentPatternCount: summary.componentPatternCount,
      modalContractCount: summary.modalContractCount,
    };
  }
}
