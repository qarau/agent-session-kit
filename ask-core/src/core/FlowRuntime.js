import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { BehaviorReplayEngine } from './BehaviorReplayEngine.js';
import { FlowDiscoveryEngine } from './FlowDiscoveryEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

const FLOW_STAGES = ['experimental', 'observed', 'accepted', 'protected', 'hard-flow'];

function normalizeStage(value) {
  const normalized = normalize(value).toLowerCase();
  if (FLOW_STAGES.includes(normalized)) {
    return normalized;
  }
  if (normalized === 'hard' || normalized === 'hardflow') {
    return 'hard-flow';
  }
  if (normalized === 'critical') {
    return 'protected';
  }
  return 'experimental';
}

function stageRank(stage) {
  const index = FLOW_STAGES.indexOf(normalizeStage(stage));
  return index < 0 ? 0 : index;
}

function canPromote(fromStage, toStage) {
  const from = stageRank(fromStage);
  const to = stageRank(toStage);
  return to === from + 1;
}

function criticalityFromStage(stage) {
  return normalizeStage(stage);
}

function summarizeStageCounts(flows = []) {
  const counts = {
    experimental: 0,
    observed: 0,
    accepted: 0,
    protected: 0,
    'hard-flow': 0,
  };
  for (const flow of flows) {
    const stage = normalizeStage(flow.stage || flow.criticality);
    counts[stage] = (counts[stage] || 0) + 1;
  }
  return counts;
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

function isProtected(criticality) {
  const normalized = normalize(criticality).toLowerCase();
  return normalized === 'protected' || normalized === 'hard-flow';
}

function isHardFlow(criticality) {
  return normalize(criticality).toLowerCase() === 'hard-flow';
}

function latestValidationPassed(validation = {}) {
  const status = normalize(validation.status).toLowerCase();
  return status === 'passed' || status === 'warning';
}

export class FlowRuntime {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.behaviorReplayEngine = new BehaviorReplayEngine();
    this.flowDiscoveryEngine = new FlowDiscoveryEngine();
  }

  async readContract() {
    const raw = await this.store.readJson(this.paths.productFlowContract(), { flows: [] });
    const flows = Array.isArray(raw?.flows) ? raw.flows : [];
    return {
      version: raw?.version || 1,
      flows: flows
        .filter(Boolean)
        .map(flow => ({
          id: normalize(flow.id),
          name: normalize(flow.name || flow.id),
          stage: normalizeStage(flow.stage || flow.criticality),
          criticality: criticalityFromStage(flow.stage || flow.criticality || 'experimental'),
          given: normalize(flow.given),
          when: normalize(flow.when),
          then: Array.isArray(flow.then) ? flow.then.map(item => normalize(item)).filter(Boolean) : [],
          mustNever: Array.isArray(flow.mustNever) ? flow.mustNever.map(item => normalize(item)).filter(Boolean) : [],
          lifecycle: flow.lifecycle && typeof flow.lifecycle === 'object' ? flow.lifecycle : {},
          updatedAt: normalize(flow.updatedAt),
        }))
        .filter(flow => flow.id),
    };
  }

  async readFlowMap() {
    return this.store.readJson(this.paths.flowMap(), {});
  }

  async writeContract(contract = {}) {
    await this.store.writeJson(this.paths.productFlowContract(), {
      version: contract.version || 1,
      flows: Array.isArray(contract.flows) ? contract.flows : [],
    });
  }

  flowDocFromContract(contract = {}) {
    const flows = Array.isArray(contract.flows) ? contract.flows : [];
    const lines = ['# Product Flow Memory', ''];
    for (const flow of flows) {
      lines.push(`## ${flow.name || flow.id}`);
      if (flow.given) {
        lines.push(`Given: ${flow.given}`);
      }
      if (flow.when) {
        lines.push(`When: ${flow.when}`);
      }
      if (Array.isArray(flow.then) && flow.then.length > 0) {
        lines.push('Then:');
        for (const assertion of flow.then) {
          lines.push(`- ${assertion}`);
        }
      }
      lines.push(`Stage: ${String(flow.stage || flow.criticality || 'experimental').toUpperCase()}`);
      lines.push('');
    }
    return `${lines.join('\n').trim()}\n`;
  }

  async writeFlowDoc(contract = {}) {
    const body = this.flowDocFromContract(contract);
    await this.store.writeText(this.paths.productFlowDoc(), body);
  }

  async listFlows() {
    const contract = await this.readContract();
    const counts = summarizeStageCounts(contract.flows);
    return {
      flows: contract.flows,
      stageCounts: counts,
      version: contract.version || 1,
    };
  }

  flowPatterns(flowMap, flowId) {
    const entry = flowMap?.[flowId] || {};
    const files = Array.isArray(entry.files) ? entry.files.map(item => normalizePath(item)).filter(Boolean) : [];
    const tests = Array.isArray(entry.tests) ? entry.tests.map(item => normalize(item).toLowerCase()).filter(Boolean) : [];
    return {
      files,
      tests,
    };
  }

  impactedFlows(flows = [], flowMap = {}, touchedFiles = []) {
    const normalizedTouched = touchedFiles.map(value => normalizePath(value)).filter(Boolean);
    const impacted = [];
    for (const flow of flows) {
      const mapping = this.flowPatterns(flowMap, flow.id);
      const hasMatch = mapping.files.some(pattern => normalizedTouched.some(filePath => matchPattern(filePath, pattern)));
      if (hasMatch) {
        impacted.push({
          ...flow,
          mappedFiles: mapping.files,
          expectedTests: mapping.tests,
        });
      }
    }
    return impacted;
  }

  testsCoverFlow(expectedTests = [], testsRun = []) {
    if (expectedTests.length < 1) {
      return true;
    }
    const normalizedTests = testsRun.map(test => normalize(test).toLowerCase());
    return expectedTests.every(required => normalizedTests.some(test => test.includes(required)));
  }

  normalizePromotionTarget(toStage) {
    const normalized = normalizeStage(toStage);
    if (!FLOW_STAGES.includes(normalized)) {
      return '';
    }
    return normalized;
  }

  validatePromotionGovernance({ fromStage, toStage, reason, approvedBy, approvalTicket, policy = {} }) {
    const normalizedReason = normalize(reason);
    const normalizedApprovedBy = normalize(approvedBy);
    const normalizedApprovalTicket = normalize(approvalTicket);
    const requireReason = policy?.flow?.require_promotion_reason !== false;
    const minLength = toNumber(policy?.flow?.promotion_reason_min_length, 10);
    if (requireReason && normalizedReason.length < minLength) {
      return {
        ok: false,
        code: 'invalid-promotion-reason',
        message: `promotion reason must be at least ${String(minLength)} characters`,
      };
    }
    const target = normalizeStage(toStage);
    const needsProtectedApproval = target === 'protected' && policy?.flow?.require_approval_for_protected === true;
    const needsProtectedTicket = target === 'protected' && policy?.flow?.require_approval_ticket_for_protected === true;
    const needsHardApproval = target === 'hard-flow' && policy?.flow?.require_approval_for_hard_flow === true;
    const needsHardTicket = target === 'hard-flow' && policy?.flow?.require_approval_ticket_for_hard_flow === true;
    if ((needsProtectedApproval || needsHardApproval) && !normalizedApprovedBy) {
      return {
        ok: false,
        code: 'missing-promotion-approval',
        message: `promotion from ${normalizeStage(fromStage)} to ${target} requires --approved-by`,
      };
    }
    if ((needsProtectedTicket || needsHardTicket) && !normalizedApprovalTicket) {
      return {
        ok: false,
        code: 'missing-promotion-approval-ticket',
        message: `promotion from ${normalizeStage(fromStage)} to ${target} requires --approval-ticket`,
      };
    }
    return {
      ok: true,
      approvedBy: normalizedApprovedBy,
      approvalTicket: normalizedApprovalTicket,
      reason: normalizedReason,
    };
  }

  async promoteFlow({ flowId, toStage, reason, approvedBy, approvalTicket, policy = {} }) {
    const id = normalize(flowId);
    if (!id) {
      return {
        ok: false,
        code: 'missing-flow-id',
        message: 'flow id is required',
      };
    }
    const targetStage = this.normalizePromotionTarget(toStage);
    if (!targetStage) {
      return {
        ok: false,
        code: 'invalid-target-stage',
        message: `target stage must be one of ${FLOW_STAGES.join(', ')}`,
      };
    }

    const contract = await this.readContract();
    const flowIndex = contract.flows.findIndex(flow => flow.id === id);
    if (flowIndex < 0) {
      return {
        ok: false,
        code: 'flow-not-found',
        message: `flow not found: ${id}`,
      };
    }
    const flow = contract.flows[flowIndex];
    const fromStage = normalizeStage(flow.stage || flow.criticality);
    if (fromStage === targetStage) {
      return {
        ok: false,
        code: 'noop-promotion',
        message: `flow ${id} is already in stage ${targetStage}`,
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
    const updatedFlow = {
      ...flow,
      stage: targetStage,
      criticality: criticalityFromStage(targetStage),
      updatedAt: promotedAt,
      lifecycle: {
        ...(flow.lifecycle || {}),
        promotedFrom: fromStage,
        promotedTo: targetStage,
        promotedAt,
        promotedBy: governance.approvedBy,
        approvalTicket: governance.approvalTicket,
        reason: governance.reason,
      },
    };
    const nextFlows = [...contract.flows];
    nextFlows[flowIndex] = updatedFlow;
    const nextContract = {
      version: contract.version || 1,
      flows: nextFlows,
    };
    await this.writeContract(nextContract);
    await this.writeFlowDoc(nextContract);
    await this.appendHistory({
      type: 'FlowPromoted',
      ts: promotedAt,
      flowId: id,
      from: fromStage,
      to: targetStage,
      reason: governance.reason,
      approvedBy: governance.approvedBy,
      approvalTicket: governance.approvalTicket,
    });
    const listed = await this.listFlows();
    return {
      ok: true,
      flow: updatedFlow,
      summary: {
        flowId: id,
        from: fromStage,
        to: targetStage,
      },
      stageCounts: listed.stageCounts,
    };
  }

  async updateMetrics({ protectedViolationCount, hardViolationCount }) {
    const previous = await this.store.readJson(this.paths.flowMetrics(), {
      validationRuns: 0,
      flowRegressionRate: 0,
      protectedFlowViolations: 0,
      hardFlowViolations: 0,
      behaviorDriftTrend: 'stable',
      updatedAt: '',
    });
    const validationRuns = toNumber(previous.validationRuns, 0) + 1;
    const protectedFlowViolations = toNumber(previous.protectedFlowViolations, 0) + protectedViolationCount;
    const hardFlowViolations = toNumber(previous.hardFlowViolations, 0) + hardViolationCount;
    const regressions = protectedFlowViolations + hardFlowViolations;
    const flowRegressionRate = validationRuns > 0 ? Number((regressions / validationRuns).toFixed(4)) : 0;
    const behaviorDriftTrend = hardViolationCount > 0
      ? 'regressing'
      : protectedViolationCount > 0
        ? 'watch'
        : 'stable';
    const next = {
      validationRuns,
      flowRegressionRate,
      protectedFlowViolations,
      hardFlowViolations,
      behaviorDriftTrend,
      updatedAt: nowIso(),
    };
    await this.store.writeJson(this.paths.flowMetrics(), next);
    return next;
  }

  async appendHistory(entry) {
    await this.store.appendLine(this.paths.flowHistory(), JSON.stringify(entry));
  }

  async discover({ slice = {}, execution = {}, validation = {}, policy = {} }) {
    const contract = await this.readContract();
    const flowMap = await this.readFlowMap();
    const discovery = this.flowDiscoveryEngine.discoverFromEvidence({
      contract,
      flowMap,
      execution,
      validation,
      policy,
    });

    if (discovery.discovered.length < 1) {
      const payload = {
        ok: true,
        status: 'noop',
        reason: discovery.reason,
        sliceId: normalize(slice.id),
        discoveredCount: 0,
        examinedFiles: discovery.examinedFiles,
        skippedMappedFiles: discovery.skippedMappedFiles,
        discoveredFlows: [],
      };
      await this.appendHistory({
        type: 'FlowDiscoveryRun',
        ts: nowIso(),
        sliceId: normalize(slice.id),
        status: 'noop',
        reason: payload.reason,
        discoveredCount: 0,
      });
      return payload;
    }

    const discoveredAt = nowIso();
    const nextFlows = [
      ...contract.flows,
      ...discovery.discovered.map(item => item.flow),
    ];
    const nextFlowMap = { ...flowMap };
    for (const item of discovery.discovered) {
      nextFlowMap[item.flow.id] = item.map;
    }

    const nextContract = {
      version: contract.version || 1,
      flows: nextFlows,
    };
    await this.writeContract(nextContract);
    await this.writeFlowDoc(nextContract);
    await this.store.writeJson(this.paths.flowMap(), nextFlowMap);

    for (const item of discovery.discovered) {
      await this.appendHistory({
        type: 'FlowDiscovered',
        ts: discoveredAt,
        sliceId: normalize(slice.id),
        flowId: item.flow.id,
        stage: item.flow.stage,
        sourceFile: item.flow.lifecycle?.sourceFile || '',
      });
    }
    await this.appendHistory({
      type: 'FlowDiscoveryRun',
      ts: discoveredAt,
      sliceId: normalize(slice.id),
      status: 'discovered',
      discoveredCount: discovery.discovered.length,
    });

    const listed = await this.listFlows();
    return {
      ok: true,
      status: 'discovered',
      reason: discovery.reason,
      sliceId: normalize(slice.id),
      discoveredCount: discovery.discovered.length,
      examinedFiles: discovery.examinedFiles,
      skippedMappedFiles: discovery.skippedMappedFiles,
      discoveredFlows: discovery.discovered.map(item => ({
        id: item.flow.id,
        name: item.flow.name,
        stage: item.flow.stage,
      })),
      stageCounts: listed.stageCounts,
    };
  }

  async validate({ slice = {}, execution = {}, validation = {}, policy = {} }) {
    const enabled = policy?.flow?.enabled !== false;
    if (!enabled) {
      const disabled = {
        status: 'skipped',
        blocking: false,
        reason: 'flow runtime disabled by policy',
        sliceId: normalize(slice.id),
        impactedFlows: [],
        protectedFlowViolations: [],
        hardFlowViolations: [],
        behaviorReplay: {
          status: 'skipped',
          confidence: 0,
          impactedFlowCount: 0,
          flowReplays: [],
          regressionEvidence: [],
        },
        updatedAt: nowIso(),
      };
      await this.store.writeJson(this.paths.flowStatus(), disabled);
      return disabled;
    }

    const contract = await this.readContract();
    const flowMap = await this.readFlowMap();
    const touchedFiles = Array.isArray(execution.touchedFiles) ? execution.touchedFiles : [];
    const testsRun = Array.isArray(validation.testsRun) ? validation.testsRun : [];
    const impactedFlows = this.impactedFlows(contract.flows, flowMap, touchedFiles);
    const protectedFlowViolations = [];
    const hardFlowViolations = [];
    const requireFlowMapForHardFlow = policy?.flow?.require_flow_map_for_hard_flow === true;
    const executionAndValidationPassed = execution.ok === true && latestValidationPassed(validation);

    for (const flow of impactedFlows) {
      const mapEntry = flowMap?.[flow.id];
      const hasMap = Boolean(mapEntry && Array.isArray(mapEntry.files) && mapEntry.files.length > 0);
      const hasCoverage = this.testsCoverFlow(flow.expectedTests, testsRun);
      const reasons = [];
      if (requireFlowMapForHardFlow && isHardFlow(flow.criticality) && !hasMap) {
        reasons.push('hard-flow has no flow-map file coverage');
      }
      if (!executionAndValidationPassed) {
        reasons.push('execution/validation failed for impacted flow');
      }
      if (!hasCoverage) {
        reasons.push('expected flow test evidence missing');
      }
      if (reasons.length > 0 && isProtected(flow.criticality)) {
        const issue = {
          flowId: flow.id,
          stage: flow.stage,
          criticality: flow.criticality,
          reason: reasons.join('; '),
          expectedTests: flow.expectedTests,
        };
        protectedFlowViolations.push(issue);
        if (isHardFlow(flow.criticality)) {
          hardFlowViolations.push(issue);
        }
      }
    }

    const behaviorReplayEnabled = policy?.flow?.behavior_replay_enabled !== false;
    const behaviorReplay = behaviorReplayEnabled
      ? this.behaviorReplayEngine.evaluate({
        impactedFlows,
        execution,
        validation,
        policy,
      })
      : {
        status: 'skipped',
        confidence: 0,
        impactedFlowCount: impactedFlows.length,
        flowReplays: [],
        regressionEvidence: [],
      };
    if (behaviorReplayEnabled) {
      for (const replay of behaviorReplay.flowReplays) {
        if (replay.status === 'failed' && (replay.stage === 'protected' || replay.stage === 'hard-flow')) {
          const reason = replay.evidence.map(item => item.detail).filter(Boolean).join('; ')
            || `behavior replay failed for ${replay.flowId}`;
          const issue = {
            flowId: replay.flowId,
            stage: replay.stage,
            criticality: replay.stage,
            reason,
            confidence: replay.confidence,
            minConfidence: replay.minConfidence,
          };
          protectedFlowViolations.push(issue);
          if (replay.stage === 'hard-flow') {
            hardFlowViolations.push(issue);
          }
        }
      }
    }

    const blockOnHardFlowViolation = policy?.flow?.block_on_hard_flow_violation !== false;
    const blockOnProtectedFlowViolation = policy?.flow?.block_on_protected_flow_violation === true;
    const blocking = (blockOnHardFlowViolation && hardFlowViolations.length > 0)
      || (blockOnProtectedFlowViolation && protectedFlowViolations.length > 0);

    const metrics = await this.updateMetrics({
      protectedViolationCount: protectedFlowViolations.length,
      hardViolationCount: hardFlowViolations.length,
    });
    const status = blocking
      ? 'failed'
      : protectedFlowViolations.length > 0
        ? 'warning'
        : 'passed';
    const payload = {
      status,
      blocking,
      reason: blocking
        ? 'flow governance blocked by protected behavior violations'
        : protectedFlowViolations.length > 0
          ? 'flow governance warnings detected'
          : 'flow governance passed',
      sliceId: normalize(slice.id),
      impactedFlows: impactedFlows.map(flow => ({
        id: flow.id,
        name: flow.name,
        stage: flow.stage,
        criticality: flow.criticality,
      })),
      protectedFlowViolations,
      hardFlowViolations,
      behaviorReplay,
      metrics,
      updatedAt: nowIso(),
    };

    await this.store.writeJson(this.paths.flowStatus(), payload);
    await this.appendHistory({
      type: 'FlowValidated',
      ts: nowIso(),
      sliceId: normalize(slice.id),
      status: payload.status,
      impactedFlowCount: payload.impactedFlows.length,
      protectedFlowViolations: protectedFlowViolations.length,
      hardFlowViolations: hardFlowViolations.length,
    });
    return payload;
  }

  async readStatus() {
    const status = await this.store.readJson(this.paths.flowStatus(), {
      status: 'unknown',
      blocking: false,
      impactedFlows: [],
      protectedFlowViolations: [],
      hardFlowViolations: [],
      behaviorReplay: {
        status: 'unknown',
        confidence: 0,
        impactedFlowCount: 0,
        flowReplays: [],
        regressionEvidence: [],
      },
      updatedAt: '',
    });
    const metrics = await this.store.readJson(this.paths.flowMetrics(), {
      validationRuns: 0,
      flowRegressionRate: 0,
      protectedFlowViolations: 0,
      hardFlowViolations: 0,
      behaviorDriftTrend: 'stable',
      updatedAt: '',
    });
    const listed = await this.listFlows();
    return {
      ...status,
      metrics,
      stageCounts: listed.stageCounts,
      flows: listed.flows,
    };
  }
}
