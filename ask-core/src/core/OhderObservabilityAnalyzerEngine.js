import fs from 'node:fs';
import path from 'node:path';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function unique(values = []) {
  return Array.from(new Set(values.map(normalizePath).filter(Boolean)));
}

function readFileSafe(cwd, filePath) {
  try {
    return fs.readFileSync(path.resolve(cwd, normalizePath(filePath)), 'utf8');
  } catch {
    return '';
  }
}

function isAnalyzableSourceFile(filePath) {
  const normalized = normalizePath(filePath);
  if (!/\.(?:mjs|js|cjs|ts|tsx|jsx)$/u.test(normalized)) {
    return false;
  }
  if (/(?:^|\/)(?:test|tests|__tests__)\//u.test(normalized) || /\.(?:test|spec)\./u.test(normalized)) {
    return false;
  }
  return normalized.includes('/src/') || normalized.startsWith('src/');
}

function hasEventSignal(source = '') {
  return /\b(?:appendEvent|recordEvent|EventLedger|eventLedger|events\.append|recorder\.record)\b/u.test(source);
}

function hasGovernanceMutation(source = '') {
  return [
    /\bwriteJson\s*\(\s*paths\.(?:governanceDecision|architectStatus|taskBoardSnapshot|runtimeState|projectionState|metrics)/u,
    /\.(?:set|update|delete)\s*\([^)]*(?:governance|runtime|architect|task|session|projection)[^)]*\)/iu,
  ].some(pattern => pattern.test(source));
}

function silentFailureReturns(source = '') {
  const violations = [];
  const pattern = /return\s*\{(?<body>[^}]*\bok\s*:\s*false[^}]*)\}/gsu;
  let match = pattern.exec(source);
  while (match) {
    const body = match.groups?.body || '';
    if (!/\bcode\s*:/u.test(body) || !/\bmessage\s*:/u.test(body)) {
      violations.push({
        kind: 'silent-blocking-result',
        severity: 'high',
        reason: 'runtime returns ok false without diagnostic code or message',
      });
    }
    match = pattern.exec(source);
  }
  return violations;
}

function analyzeFile(cwd, filePath) {
  const source = readFileSafe(cwd, filePath);
  const eventBacked = hasEventSignal(source);
  const governanceMutation = hasGovernanceMutation(source);
  const violations = silentFailureReturns(source).map(item => ({
    filePath,
    ...item,
  }));
  if (governanceMutation && !eventBacked) {
    violations.push({
      filePath,
      kind: 'governance-mutation-without-event',
      severity: 'high',
      reason: 'governance state mutation lacks event emission for replay or debugging evidence',
    });
  }
  return {
    filePath,
    eventBacked,
    governanceMutation,
    violations,
  };
}

export class OhderObservabilityAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : [])
      .filter(filePath => isAnalyzableSourceFile(filePath));
    const filesAnalyzed = files.map(filePath => analyzeFile(this.cwd, filePath));
    const violations = filesAnalyzed.flatMap(item => item.violations);
    const findings = violations.map(item => `${item.reason}: ${item.filePath}`);
    return {
      risk: violations.length > 0 ? 'high' : 'low',
      observabilityValid: violations.length === 0,
      filesAnalyzed,
      violations,
      findings,
      recommendations: violations.length > 0
        ? ['Emit replayable events and return diagnostic code/message fields for blocking governance paths.']
        : [],
    };
  }
}
