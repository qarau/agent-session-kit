import path from 'node:path';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { EventLedger } from '../runtime/EventLedger.js';
import { RuntimeProjectionEngine } from '../runtime/RuntimeProjectionEngine.js';
import { FindingFingerprintEngine } from './FindingFingerprintEngine.js';
import { FindingMetricsEngine } from './FindingMetricsEngine.js';

const DECISIONS = new Set([
  'fix-planned',
  'false-positive',
  'justified-risk',
  'exempt',
  'tune-law',
  'tune-analyzer',
]);

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function relativeEvidenceRef(findingId) {
  return `.ask/runtime/findings/evidence/${findingId}.json`;
}

function severityRank(value) {
  const ranks = { low: 1, medium: 2, high: 3, critical: 4 };
  return ranks[normalizeLower(value)] ?? 0;
}

function strongestSeverity(left, right) {
  return severityRank(right) > severityRank(left) ? normalizeLower(right) : normalizeLower(left);
}

function statusForDecision(decision) {
  const normalized = normalizeLower(decision);
  if (normalized === 'false-positive') {
    return 'suppressed';
  }
  if (normalized === 'exempt') {
    return 'exempted';
  }
  if (normalized === 'justified-risk') {
    return 'accepted-risk';
  }
  return 'reviewing';
}

function eventTypeForDecision(decision) {
  const normalized = normalizeLower(decision);
  if (normalized === 'false-positive') {
    return 'OhderFindingSuppressed';
  }
  if (normalized === 'exempt') {
    return 'OhderFindingExempted';
  }
  if (normalized === 'justified-risk') {
    return 'OhderFindingAcceptedRisk';
  }
  if (normalized === 'tune-law') {
    return 'OhderLawTuningRequested';
  }
  if (normalized === 'tune-analyzer') {
    return 'OhderAnalyzerTuningRequested';
  }
  return 'OhderFindingResolved';
}

function factKey(fact = {}) {
  return normalize(fact.factId) || `${normalize(fact.metric)}:${normalize(fact.source)}`;
}

function scopeForFact(fact = {}) {
  const evidence = Array.isArray(fact.evidence) ? fact.evidence : [];
  const reasons = evidence.map(item => normalize(item.reason)).filter(Boolean);
  if (reasons.length > 0) {
    return reasons.sort()[0].replace(/:.*$/u, '').toLowerCase();
  }
  return normalize(fact.metric) || 'runtime';
}

function normalizeEvidence(fact = {}, violation = null) {
  const factEvidence = Array.isArray(fact.evidence) ? fact.evidence : [];
  return factEvidence.map(item => ({
    filePath: normalize(item.filePath).replace(/\\/gu, '/'),
    reason: normalize(item.reason),
    lineHint: normalize(item.lineHint),
  })).filter(item => item.filePath || item.reason || item.lineHint)
    .concat(violation ? [{
      reason: normalize(violation.message) || `${normalize(violation.metric)} ${normalize(violation.operator)} ${String(violation.expected ?? '')}`.trim(),
    }] : []);
}

function violationByMetric(lawViolations = []) {
  const byMetric = new Map();
  for (const violation of Array.isArray(lawViolations) ? lawViolations : []) {
    const metric = normalize(violation.metric);
    if (!metric) {
      continue;
    }
    const current = byMetric.get(metric);
    if (!current || severityRank(violation.severity) > severityRank(current.severity)) {
      byMetric.set(metric, violation);
    }
  }
  return byMetric;
}

function isFindingFact(fact = {}, violation = null) {
  const value = normalizeLower(fact.value);
  if (violation) {
    return true;
  }
  return ['invalid', 'at-risk', 'weak', 'high', 'failed', 'false', 'medium'].includes(value);
}

export class FindingResolutionRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
    this.ledger = new EventLedger(cwd);
    this.projectionEngine = new RuntimeProjectionEngine(cwd);
    this.fingerprints = new FindingFingerprintEngine();
    this.metrics = new FindingMetricsEngine();
  }

  async readProjection() {
    return this.store.readJson(this.paths.ohderFindings(), {
      version: 1,
      updatedAt: '',
      findings: {},
    });
  }

  async list({ status = '' } = {}) {
    const projection = await this.readProjection();
    const normalizedStatus = normalizeLower(status);
    const findings = Object.values(projection.findings || {})
      .filter(finding => !normalizedStatus || normalizeLower(finding.status) === normalizedStatus)
      .sort((left, right) => {
        if (severityRank(right.severity) !== severityRank(left.severity)) {
          return severityRank(right.severity) - severityRank(left.severity);
        }
        return normalize(left.id).localeCompare(normalize(right.id));
      });
    return {
      ok: true,
      findings,
    };
  }

  async explain(findingId) {
    const projection = await this.readProjection();
    const id = normalize(findingId);
    const finding = projection.findings?.[id];
    if (!finding) {
      return {
        ok: false,
        code: 'finding-not-found',
        message: `finding not found: ${id}`,
        findingId: id,
      };
    }
    const evidence = await this.store.readJson(this.paths.ohderFindingEvidence(id), {
      findingId: id,
      evidence: {},
    });
    await this.ledger.append({
      type: 'OhderFindingReviewed',
      sessionId: '',
      actor: 'local',
      payload: {
        findingId: id,
      },
      meta: {
        source: 'finding-resolution-runtime',
        schemaVersion: 1,
      },
    });
    await this.ledger.append({
      type: 'OhderFindingExplained',
      sessionId: '',
      actor: 'local',
      payload: {
        findingId: id,
      },
      meta: {
        source: 'finding-resolution-runtime',
        schemaVersion: 1,
      },
    });
    await this.projectionEngine.projectIncremental();
    return {
      ok: true,
      finding,
      evidence,
      priorResolutions: Array.isArray(finding.history)
        ? finding.history.filter(item => item.resolution)
        : [],
      suggestedActions: this.suggestedActions(finding),
    };
  }

  suggestedActions(finding = {}) {
    const actions = ['Inspect the evidence before changing code or policy.'];
    if (finding.blocking === true) {
      actions.push('Fix the architecture issue or use an approved short-lived law exemption if the block is valid but temporarily unavoidable.');
    }
    actions.push('Resolve as false-positive only when the analyzer claim is incorrect.');
    actions.push('Use tune-law or tune-analyzer when the governance rule is too noisy.');
    return actions;
  }

  buildFinding({ fact = {}, violation = null, architect = {}, previous = null } = {}) {
    const metric = normalize(fact.metric || violation?.metric);
    const analyzerId = normalize(fact.source) || 'OhderArchitectRuntime';
    const lawId = normalize(violation?.id);
    const evidence = normalizeEvidence(fact, violation);
    const scope = scopeForFact(fact);
    const id = this.fingerprints.fingerprint({
      metric,
      analyzerId,
      lawId,
      scope,
      evidence,
      normalizedEvidenceFingerprint: normalize(factKey(fact)),
    });
    const timestamp = nowIso();
    return {
      id,
      status: previous?.status || 'open',
      severity: strongestSeverity(fact.severity, violation?.severity || fact.severity) || 'low',
      confidence: normalizeLower(fact.confidence) || 'low',
      metric,
      analyzerId,
      lawId,
      scope,
      blocking: architect.blocking === true && normalize(violation?.outcome) === 'block',
      createdAt: previous?.createdAt || timestamp,
      updatedAt: timestamp,
      evidenceRef: relativeEvidenceRef(id),
      resolution: previous?.resolution ?? null,
      history: Array.isArray(previous?.history) ? [...previous.history] : [],
      semanticFact: fact,
      lawViolation: violation,
    };
  }

  async writeEvidencePack(finding) {
    const evidence = {
      findingId: finding.id,
      generatedAt: nowIso(),
      evidence: {
        semanticFact: finding.semanticFact || null,
        lawViolation: finding.lawViolation || null,
        files: Array.isArray(finding.semanticFact?.evidence)
          ? finding.semanticFact.evidence.map(item => normalize(item.filePath)).filter(Boolean)
          : [],
        reasoning: Array.isArray(finding.semanticFact?.evidence)
          ? finding.semanticFact.evidence.map(item => normalize(item.reason)).filter(Boolean)
          : [],
      },
    };
    await this.store.writeJson(this.paths.ohderFindingEvidence(finding.id), evidence);
    return evidence;
  }

  eventFinding(finding) {
    const {
      semanticFact,
      lawViolation,
      ...publicFinding
    } = finding;
    return publicFinding;
  }

  async detectFromArchitect({ sessionId = '', taskId = '', architect = {} } = {}) {
    const projection = await this.readProjection();
    const lawByMetric = violationByMetric(architect.lawViolations);
    const findings = [];
    const semanticFacts = Array.isArray(architect.semanticFacts) ? architect.semanticFacts : [];
    for (const fact of semanticFacts) {
      const violation = lawByMetric.get(normalize(fact.metric)) || null;
      if (!isFindingFact(fact, violation)) {
        continue;
      }
      const candidate = this.buildFinding({
        fact,
        violation,
        architect,
        previous: projection.findings?.[this.fingerprints.fingerprint({
          metric: fact.metric,
          analyzerId: fact.source,
          lawId: violation?.id,
          scope: scopeForFact(fact),
          evidence: normalizeEvidence(fact, violation),
          normalizedEvidenceFingerprint: normalize(factKey(fact)),
        })],
      });
      findings.push(candidate);
      await this.writeEvidencePack(candidate);
      const publicFinding = this.eventFinding(candidate);
      await this.ledger.append({
        type: 'OhderFindingDetected',
        sessionId: normalize(sessionId),
        taskId: normalize(taskId),
        actor: 'local',
        payload: {
          finding: publicFinding,
        },
        meta: {
          source: 'finding-resolution-runtime',
          schemaVersion: 1,
        },
      });
      await this.ledger.append({
        type: 'OhderFindingFingerprintAssigned',
        sessionId: normalize(sessionId),
        taskId: normalize(taskId),
        actor: 'local',
        payload: {
          findingId: candidate.id,
          metric: candidate.metric,
          analyzerId: candidate.analyzerId,
          lawId: candidate.lawId,
        },
        meta: {
          source: 'finding-resolution-runtime',
          schemaVersion: 1,
        },
      });
      await this.ledger.append({
        type: 'OhderFindingEvidenceAttached',
        sessionId: normalize(sessionId),
        taskId: normalize(taskId),
        actor: 'local',
        payload: {
          findingId: candidate.id,
          evidenceRef: candidate.evidenceRef,
        },
        meta: {
          source: 'finding-resolution-runtime',
          schemaVersion: 1,
        },
      });
    }
    if (findings.length > 0) {
      await this.projectionEngine.projectIncremental();
      const nextProjection = await this.readProjection();
      const metrics = this.metrics.fromFindings(Object.values(nextProjection.findings || {}));
      await this.store.writeJson(this.paths.ohderFindingMetrics(), metrics);
      for (const finding of Object.values(nextProjection.findings || {})) {
        await this.store.writeJson(this.paths.ohderFindingHistory(finding.id), {
          findingId: finding.id,
          history: Array.isArray(finding.history) ? finding.history : [],
        });
      }
    }
    return {
      ok: true,
      findings: findings.map(finding => this.eventFinding(finding)),
    };
  }

  validateResolution(decision, reason, approvedBy, expiresAt) {
    const normalizedDecision = normalizeLower(decision);
    if (!DECISIONS.has(normalizedDecision)) {
      return {
        ok: false,
        code: 'invalid-decision',
        message: `invalid finding decision: ${normalizedDecision}`,
      };
    }
    if (normalize(reason).length < 10) {
      return {
        ok: false,
        code: 'invalid-reason',
        message: '--reason must be at least 10 characters',
      };
    }
    if (!normalize(approvedBy)) {
      return {
        ok: false,
        code: 'missing-approved-by',
        message: '--approved-by is required',
      };
    }
    if (['exempt', 'justified-risk'].includes(normalizedDecision) && !normalize(expiresAt)) {
      return {
        ok: false,
        code: 'missing-expires-at',
        message: '--expires-at is required for exempt and justified-risk decisions',
      };
    }
    return { ok: true };
  }

  async resolve(findingId, { decision = '', reason = '', approvedBy = '', expiresAt = '', taskId = '', notes = '' } = {}) {
    const id = normalize(findingId);
    const projection = await this.readProjection();
    const finding = projection.findings?.[id];
    if (!finding) {
      return {
        ok: false,
        code: 'finding-not-found',
        message: `finding not found: ${id}`,
        findingId: id,
      };
    }
    const validation = this.validateResolution(decision, reason, approvedBy, expiresAt);
    if (!validation.ok) {
      return validation;
    }
    const normalizedDecision = normalizeLower(decision);
    const status = statusForDecision(normalizedDecision);
    const payload = {
      findingId: id,
      decision: normalizedDecision,
      reason: normalize(reason),
      approvedBy: normalize(approvedBy),
      expiresAt: normalize(expiresAt),
      taskId: normalize(taskId),
      notes: normalize(notes),
      status,
    };
    await this.ledger.append({
      type: eventTypeForDecision(normalizedDecision),
      sessionId: '',
      taskId: normalize(taskId),
      actor: normalize(approvedBy) || 'local',
      payload,
      meta: {
        source: 'finding-resolution-runtime',
        schemaVersion: 1,
      },
    });
    if (eventTypeForDecision(normalizedDecision) !== 'OhderFindingResolved') {
      await this.ledger.append({
        type: 'OhderFindingResolved',
        sessionId: '',
        taskId: normalize(taskId),
        actor: normalize(approvedBy) || 'local',
        payload,
        meta: {
          source: 'finding-resolution-runtime',
          schemaVersion: 1,
        },
      });
    }
    await this.projectionEngine.projectIncremental();
    const nextProjection = await this.readProjection();
    const nextFinding = nextProjection.findings?.[id] || {
      ...finding,
      status,
      resolution: payload,
    };
    await this.store.writeJson(this.paths.ohderFindingHistory(id), {
      findingId: id,
      history: Array.isArray(nextFinding.history) ? nextFinding.history : [],
    });
    const nextMetrics = this.metrics.fromFindings(Object.values(nextProjection.findings || {}));
    await this.store.writeJson(this.paths.ohderFindingMetrics(), nextMetrics);
    return {
      ok: true,
      finding: nextFinding,
    };
  }
}
