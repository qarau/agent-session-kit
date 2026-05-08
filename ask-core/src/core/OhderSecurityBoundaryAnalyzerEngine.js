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

function isSourceFile(filePath) {
  return /\.(?:mjs|js|cjs|ts|tsx|jsx)$/u.test(normalizePath(filePath));
}

function isTestFile(filePath) {
  return /(?:^|\/)(?:test|tests|__tests__)\//u.test(normalizePath(filePath))
    || /\.(?:test|spec)\.(?:mjs|js|cjs|ts|tsx|jsx)$/u.test(normalizePath(filePath));
}

function isSecuritySensitivePath(filePath) {
  return /(?:^|\/)(?:auth|security|permission|permissions|session|sessions|token|tokens|oauth|jwt|rbac)(?:\/|$)/iu
    .test(normalizePath(filePath))
    || /(?:auth|security|permission|token|oauth|jwt|password|credential|secret)/iu.test(path.basename(normalizePath(filePath)));
}

function securitySignals(source = '') {
  const inspectedSource = stripRegexLiterals(source);
  const checks = [
    ['credential-or-secret', /\b(?:secret|password|credential|privateKey|apiKey|accessToken|refreshToken|jwt|token)\b/iu],
    ['auth-bypass', /\b(?:skipAuth|disableAuth|bypassAuth|allowAnonymous|permitAll|noAuth)\b/iu],
    ['session-mutation', /\b(?:session|cookie|authorization|bearer)\b/iu],
    ['permission-change', /\b(?:role|permission|scope|rbac|acl|authorize|authenticate)\b/iu],
  ];
  return checks
    .filter(([, pattern]) => pattern.test(inspectedSource))
    .map(([signal]) => signal);
}

function stripRegexLiterals(source = '') {
  return source.replace(/\/(?:\\.|[^/\r\n])+\/[dgimsuvy]*/gu, '');
}

function categoriesFor(signals = [], filePath = '') {
  const categories = new Set();
  const normalizedPath = normalizePath(filePath);
  if (/auth|oauth|jwt/iu.test(normalizedPath) || signals.includes('auth-bypass')) {
    categories.add('auth');
  }
  if (signals.includes('permission-change') || /permission|role|scope|rbac|acl/iu.test(normalizedPath)) {
    categories.add('authz');
  }
  if (signals.includes('credential-or-secret') || /token|secret|credential|password/iu.test(normalizedPath)) {
    categories.add('secret');
  }
  if (signals.includes('session-mutation') || /session|cookie/iu.test(normalizedPath)) {
    categories.add('session');
  }
  return Array.from(categories);
}

function hardcodedCredentialEvidence(source = '') {
  return /(?:token|secret|password|apiKey|privateKey|refreshToken|accessToken)\s*[:=]\s*['"`][^'"`]{8,}['"`]/iu.test(source);
}

function matchingTestFiles(filePath, touchedFiles) {
  const normalized = normalizePath(filePath);
  const basename = path.basename(normalized).replace(/\.(?:mjs|js|cjs|ts|tsx|jsx)$/u, '');
  return touchedFiles.filter(candidate => {
    const normalizedCandidate = normalizePath(candidate);
    return isTestFile(normalizedCandidate) && normalizedCandidate.includes(basename);
  });
}

function analyzeFile(cwd, filePath, touchedFiles) {
  const source = readFileSafe(cwd, filePath);
  const inspectedSource = stripRegexLiterals(source);
  const signals = securitySignals(source);
  const categories = categoriesFor(signals, filePath);
  const sensitive = isSecuritySensitivePath(filePath) || signals.length > 0;
  const tests = matchingTestFiles(filePath, touchedFiles);
  const findings = [];

  if (sensitive && tests.length === 0) {
    findings.push(`security-sensitive change lacks matching test coverage: ${filePath}`);
  }
  if (categories.includes('authz') && tests.length === 0) {
    findings.push(`authorization evidence missing for role, permission, or scope change: ${filePath}`);
  }
  if (signals.includes('auth-bypass')) {
    findings.push(`auth bypass signal detected: ${filePath}`);
  }
  if (signals.includes('credential-or-secret') && hardcodedCredentialEvidence(inspectedSource)) {
    findings.push(`hardcoded credential or token evidence detected: ${filePath}`);
  } else if (signals.includes('credential-or-secret') && /process\.env/iu.test(inspectedSource)) {
    findings.push(`credential or token handling changed: ${filePath}`);
  }

  return {
    filePath,
    sensitive,
    signals,
    categories,
    matchingTests: tests,
    findings,
  };
}

function riskFor(filesAnalyzed) {
  const findingCount = filesAnalyzed.reduce((total, item) => total + item.findings.length, 0);
  if (
    filesAnalyzed.some(item => item.signals.includes('auth-bypass'))
    || filesAnalyzed.some(item => item.categories.includes('authz') && item.matchingTests.length === 0)
    || filesAnalyzed.some(item => item.findings.some(finding => /hardcoded credential/u.test(finding)))
    || findingCount >= 2
  ) {
    return 'high';
  }
  if (findingCount === 1) {
    return 'medium';
  }
  return 'low';
}

export class OhderSecurityBoundaryAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : [])
      .filter(filePath => isSourceFile(filePath) && !isTestFile(filePath));
    const filesAnalyzed = files
      .map(filePath => analyzeFile(this.cwd, filePath, touchedFiles))
      .filter(item => item.findings.length > 0 || item.signals.length > 0);
    const findings = filesAnalyzed.flatMap(item => item.findings);
    const risk = riskFor(filesAnalyzed);

    return {
      risk,
      boundaryValid: risk !== 'high',
      filesAnalyzed,
      findings,
      recommendations: risk === 'high'
        ? ['Add explicit tests and review authority boundaries before merging security-sensitive changes.']
        : [],
    };
  }
}
