import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function defaultLawPack() {
  return {
    version: 1,
    defaultOutcomes: {
      critical: 'block',
      high: 'retry',
      medium: 'warn',
      low: 'warn',
    },
    laws: [],
    exemptions: [],
  };
}

function readFact(facts = {}, key) {
  return facts?.[normalize(key)];
}

function compare(actual, operator, expected) {
  const op = normalizeLower(operator);
  if (op === '<=') {
    return toNumber(actual, Number.POSITIVE_INFINITY) <= toNumber(expected, Number.POSITIVE_INFINITY);
  }
  if (op === '<') {
    return toNumber(actual, Number.POSITIVE_INFINITY) < toNumber(expected, Number.POSITIVE_INFINITY);
  }
  if (op === '>=') {
    return toNumber(actual, Number.NEGATIVE_INFINITY) >= toNumber(expected, Number.NEGATIVE_INFINITY);
  }
  if (op === '>') {
    return toNumber(actual, Number.NEGATIVE_INFINITY) > toNumber(expected, Number.NEGATIVE_INFINITY);
  }
  if (op === 'in') {
    return asArray(expected).map(item => normalizeLower(item)).includes(normalizeLower(actual));
  }
  if (op === 'not-in') {
    return !asArray(expected).map(item => normalizeLower(item)).includes(normalizeLower(actual));
  }
  if (op === '!=') {
    return normalizeLower(actual) !== normalizeLower(expected);
  }
  return normalizeLower(actual) === normalizeLower(expected);
}

function outcomeRank(outcome) {
  const normalized = normalizeLower(outcome);
  if (normalized === 'block') {
    return 4;
  }
  if (normalized === 'retry') {
    return 3;
  }
  if (normalized === 'warn') {
    return 2;
  }
  return 1;
}

function mapSeverityToOutcome(defaultOutcomes = {}, severity = '') {
  const normalizedSeverity = normalizeLower(severity);
  return normalizeLower(defaultOutcomes?.[normalizedSeverity] || 'warn');
}

function normalizeLawClass(value) {
  const normalized = normalizeLower(value);
  if (normalized === 'hard' || normalized === 'soft') {
    return normalized;
  }
  return '';
}

function isExemptionActive(exemption = {}) {
  const expiresAt = normalize(exemption.expiresAt);
  if (!expiresAt) {
    return true;
  }
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) {
    return true;
  }
  return Date.now() <= expiry;
}

function matchesExemption(exemption = {}, lawId, facts = {}) {
  if (normalize(exemption.lawId) !== normalize(lawId)) {
    return false;
  }
  if (!isExemptionActive(exemption)) {
    return false;
  }
  const expectedOperation = normalize(exemption.operation);
  if (expectedOperation && expectedOperation !== normalize(facts.operation)) {
    return false;
  }
  const expectedSession = normalize(exemption.sessionId);
  if (expectedSession && expectedSession !== normalize(facts.sessionId)) {
    return false;
  }
  return true;
}

export class OhderLawPackEngine {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async load() {
    return this.store.readJson(this.paths.ohderLawPack(), defaultLawPack());
  }

  async save(lawPack = {}) {
    const normalized = {
      ...defaultLawPack(),
      ...(lawPack || {}),
      laws: asArray(lawPack?.laws),
      exemptions: asArray(lawPack?.exemptions),
    };
    await this.store.writeJson(this.paths.ohderLawPack(), normalized);
    return normalized;
  }

  async listExemptions() {
    const lawPack = await this.load();
    return asArray(lawPack.exemptions).map(item => ({
      lawId: normalize(item.lawId),
      reason: normalize(item.reason),
      approvedBy: normalize(item.approvedBy),
      operation: normalize(item.operation),
      sessionId: normalize(item.sessionId),
      expiresAt: normalize(item.expiresAt),
      createdAt: normalize(item.createdAt),
    }));
  }

  async addExemption(entry = {}) {
    const lawPack = await this.load();
    const exemptions = asArray(lawPack.exemptions);
    const normalized = {
      lawId: normalize(entry.lawId),
      reason: normalize(entry.reason),
      approvedBy: normalize(entry.approvedBy),
      operation: normalize(entry.operation),
      sessionId: normalize(entry.sessionId),
      expiresAt: normalize(entry.expiresAt),
      createdAt: nowIso(),
    };
    const key = `${normalized.lawId}|${normalized.operation}|${normalized.sessionId}`;
    const existingIndex = exemptions.findIndex(item => {
      const candidateKey = `${normalize(item.lawId)}|${normalize(item.operation)}|${normalize(item.sessionId)}`;
      return candidateKey === key;
    });
    if (existingIndex >= 0) {
      exemptions[existingIndex] = {
        ...exemptions[existingIndex],
        ...normalized,
      };
    } else {
      exemptions.push(normalized);
    }
    const saved = await this.save({
      ...lawPack,
      exemptions,
    });
    return {
      exemption: normalized,
      count: asArray(saved.exemptions).length,
    };
  }

  resolveOutcome(law = {}, lawPack = {}) {
    const direct = normalizeLower(law.outcome);
    if (direct) {
      return direct;
    }
    const lawClass = normalizeLawClass(law.lawClass);
    if (lawClass === 'hard') {
      return 'block';
    }
    if (lawClass === 'soft') {
      return 'warn';
    }
    return mapSeverityToOutcome(lawPack.defaultOutcomes || {}, law.severity);
  }

  evaluateLaw(law = {}, facts = {}, exemptions = []) {
    if (law?.enabled === false) {
      return {
        id: normalize(law.id),
        passed: true,
        skipped: true,
        exempted: false,
        outcome: 'allow',
      };
    }
    const lawId = normalize(law.id);
    const exemptedBy = exemptions.find(exemption => matchesExemption(exemption, lawId, facts));
    if (exemptedBy) {
      return {
        id: lawId,
        passed: true,
        skipped: false,
        exempted: true,
        exemptedBy: {
          lawId: normalize(exemptedBy.lawId),
          reason: normalize(exemptedBy.reason),
          approvedBy: normalize(exemptedBy.approvedBy),
          expiresAt: normalize(exemptedBy.expiresAt),
        },
        outcome: 'allow',
      };
    }

    const metric = normalize(law.metric);
    const operator = normalize(law.operator || '==');
    const expected = law.value;
    const actual = readFact(facts, metric);
    const passed = compare(actual, operator, expected);
    return {
      id: lawId,
      name: normalize(law.name || lawId),
      lawClass: normalizeLawClass(law.lawClass),
      severity: normalizeLower(law.severity || 'medium'),
      metric,
      operator,
      expected,
      actual,
      passed,
      skipped: false,
      exempted: false,
      outcome: this.resolveOutcome(law, { defaultOutcomes: facts.defaultOutcomes }),
      message: normalize(law.message),
    };
  }

  evaluate(lawPack = {}, facts = {}) {
    const normalizedPack = {
      ...defaultLawPack(),
      ...(lawPack || {}),
    };
    const laws = asArray(normalizedPack.laws);
    const exemptions = asArray(normalizedPack.exemptions);
    const evaluated = laws.map(law => this.evaluateLaw(law, {
      ...facts,
      defaultOutcomes: normalizedPack.defaultOutcomes || {},
    }, exemptions));
    const violations = evaluated.filter(item => item.skipped !== true && item.exempted !== true && item.passed !== true);

    let strongestOutcome = 'allow';
    for (const violation of violations) {
      if (outcomeRank(violation.outcome) > outcomeRank(strongestOutcome)) {
        strongestOutcome = violation.outcome;
      }
    }

    return {
      lawPackVersion: normalizedPack.version || 1,
      evaluated,
      violations,
      exempted: evaluated.filter(item => item.exempted === true),
      outcome: strongestOutcome,
      blocking: strongestOutcome === 'block',
      retryRecommended: strongestOutcome === 'retry',
      warning: strongestOutcome === 'warn',
    };
  }
}
