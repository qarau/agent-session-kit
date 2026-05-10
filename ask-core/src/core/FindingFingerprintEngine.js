import crypto from 'node:crypto';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(entry => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function semanticEvidence(evidence = []) {
  const normalized = Array.isArray(evidence) ? evidence : [];
  return normalized
    .map(item => ({
      reason: normalizeLower(item?.reason),
      lineHint: normalizeLower(item?.lineHint),
    }))
    .filter(item => item.reason || item.lineHint)
    .sort((left, right) => `${left.reason}|${left.lineHint}`.localeCompare(`${right.reason}|${right.lineHint}`));
}

function hashPayload(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload), 'utf8').digest('hex');
}

export class FindingFingerprintEngine {
  fingerprint({
    metric = '',
    analyzerId = '',
    lawId = '',
    scope = '',
    evidence = [],
    normalizedEvidenceFingerprint = '',
  } = {}) {
    const payload = {
      metric: normalizeLower(metric),
      analyzerId: normalize(analyzerId),
      lawId: normalize(lawId),
      scope: normalizeLower(scope) || 'runtime',
      evidenceFingerprint: normalizeLower(normalizedEvidenceFingerprint) || hashPayload(semanticEvidence(evidence)),
    };
    return `ohder-finding-${hashPayload(payload).slice(0, 12)}`;
  }
}
