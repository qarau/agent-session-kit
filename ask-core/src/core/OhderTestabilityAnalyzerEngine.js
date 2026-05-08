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
  const normalized = normalizePath(filePath);
  return /\.(?:mjs|js|cjs|ts|tsx|jsx)$/u.test(normalized)
    && !/(?:^|\/)(?:test|tests|__tests__)\//u.test(normalized)
    && !/\.(?:test|spec)\./u.test(normalized)
    && (normalized.includes('/src/') || normalized.startsWith('src/'));
}

function isTestFile(filePath) {
  const normalized = normalizePath(filePath);
  return /\.(?:mjs|js|cjs|ts|tsx|jsx)$/u.test(normalized)
    && (/(?:^|\/)(?:test|tests|__tests__)\//u.test(normalized) || /\.(?:test|spec)\./u.test(normalized));
}

function exportedSymbols(source = '') {
  const symbols = [];
  const pattern = /export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gu;
  let match = pattern.exec(source);
  while (match) {
    symbols.push(match[1]);
    match = pattern.exec(source);
  }
  return symbols;
}

function matchingTests(cwd, sourceFile, symbols = [], touchedTests = []) {
  const sourceBase = path.posix.basename(normalizePath(sourceFile), path.posix.extname(normalizePath(sourceFile))).toLowerCase();
  return touchedTests.filter(testFile => {
    const testSource = readFileSafe(cwd, testFile);
    const testBase = path.posix.basename(normalizePath(testFile)).toLowerCase();
    return testSource.toLowerCase().includes(sourceBase)
      || testBase.includes(sourceBase.toLowerCase())
      || symbols.some(symbol => testSource.includes(symbol));
  });
}

function stripRegexLiterals(source = '') {
  return source.replace(/\/(?:\\.|[^/\r\n])+\/[dgimsuvy]*/gu, '');
}

function hasGlobalCoupling(source = '') {
  return /\b(?:process\.env|process\.argv|globalThis|Date\.now|Math\.random)\b/u.test(stripRegexLiterals(source));
}

function hasFilesystemCoupling(source = '') {
  return /\b(?:node:fs|fs\.|readFileSync|writeFileSync|FileStore)\b/u.test(source);
}

function hasPolicyDecisionLogic(source = '') {
  return /\bpolicy\b/u.test(source) && /\bif\s*\(/u.test(source);
}

function riskFor(violations = []) {
  if (violations.some(item => item.severity === 'high') || violations.length >= 2) {
    return 'high';
  }
  if (violations.length > 0) {
    return 'medium';
  }
  return 'low';
}

export class OhderTestabilityAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [], validation = {} } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : []);
    const sourceFiles = files.filter(isSourceFile);
    const touchedTests = files.filter(isTestFile);
    const fullSuiteEvidence = Array.isArray(validation.testsRun)
      && validation.testsRun.some(item => normalize(item).toLowerCase().includes('npm test'));
    const filesAnalyzed = [];
    const violations = [];

    for (const filePath of sourceFiles) {
      const source = readFileSafe(this.cwd, filePath);
      const symbols = exportedSymbols(source);
      const tests = matchingTests(this.cwd, filePath, symbols, touchedTests);
      const fileViolations = [];
      if (symbols.length > 0 && tests.length === 0 && !fullSuiteEvidence) {
        fileViolations.push({
          filePath,
          kind: 'untested-exported-runtime-behavior',
          severity: 'high',
          reason: 'exported runtime behavior changed without matching contract test',
        });
      }
      if (normalizePath(filePath).includes('/src/cli/') && hasFilesystemCoupling(source) && hasPolicyDecisionLogic(source)) {
        fileViolations.push({
          filePath,
          kind: 'cli-heavy-decision-logic',
          severity: 'high',
          reason: 'CLI command mixes parsing, policy, filesystem, and decision logic',
        });
      }
      if (normalizePath(filePath).includes('/src/core/') && hasGlobalCoupling(source)) {
        fileViolations.push({
          filePath,
          kind: 'core-global-state-coupling',
          severity: tests.length > 0 || fullSuiteEvidence ? 'medium' : 'high',
          reason: 'core runtime logic is directly coupled to process or global state',
        });
      }
      violations.push(...fileViolations);
      filesAnalyzed.push({
        filePath,
        exportedSymbols: symbols,
        matchingTests: tests,
        filesystemCoupled: hasFilesystemCoupling(source),
        globalCoupled: hasGlobalCoupling(source),
        violations: fileViolations,
      });
    }

    const findings = violations.map(item => `${item.reason}: ${item.filePath}`);
    const risk = riskFor(violations);
    return {
      risk,
      testabilityValid: violations.length === 0,
      filesAnalyzed,
      violations,
      findings,
      recommendations: violations.length > 0
        ? ['Add focused contract tests or extract pure core decisions away from CLI, filesystem, and global state coupling.']
        : [],
    };
  }
}
