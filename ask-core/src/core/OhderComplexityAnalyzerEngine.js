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

function countMatches(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}

function concernSignals(source = '', filePath = '') {
  const combined = `${normalizePath(filePath)}\n${source}`;
  const signals = [];
  const checks = [
    ['cli', /\/cli\/|process\.argv|console\./u],
    ['filesystem', /node:fs|writeFile|readFile|FileStore/u],
    ['policy', /policy|lawPack|governance/u],
    ['projection', /projector|snapshot|projection|ledger/u],
    ['scoring', /score|risk|entropy|coupling/u],
    ['subprocess', /spawn|execFile|child_process/u],
    ['documentation', /README|docs\//u],
  ];
  for (const [signal, pattern] of checks) {
    if (pattern.test(combined)) {
      signals.push(signal);
    }
  }
  return signals;
}

function analyzeFile(cwd, filePath) {
  const source = readFileSafe(cwd, filePath);
  const lines = source.split(/\r?\n/u).filter(line => line.trim()).length;
  const branches = countMatches(source, /\b(?:if|else if|for|while|case|catch|\?\s*[^:]+:)\b/gu);
  const functions = countMatches(source, /\b(?:function|class|async\s+function)\b|=>/gu);
  const concerns = concernSignals(source, filePath);
  const complexityPoints = Math.floor(lines / 80) + Math.floor(branches / 10) + Math.floor(functions / 12);
  const srpPoints = concerns.length >= 4 ? 2 : concerns.length >= 3 ? 1 : 0;
  const complexityDelta = Math.min(6, complexityPoints + srpPoints);
  const findings = [];
  if (lines >= 120) {
    findings.push(`large file: ${filePath} has ${String(lines)} non-empty lines`);
  }
  if (branches >= 12) {
    findings.push(`branch-heavy file: ${filePath} has ${String(branches)} branch points`);
  }
  if (concerns.length >= 3) {
    findings.push(`mixed responsibilities: ${filePath} combines ${concerns.join(', ')}`);
  }
  return {
    filePath,
    lines,
    branches,
    functions,
    concerns,
    complexityDelta,
    findings,
  };
}

function riskFor(delta) {
  if (delta >= 4) {
    return 'high';
  }
  if (delta >= 2) {
    return 'medium';
  }
  return 'low';
}

export class OhderComplexityAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : [])
      .filter(filePath => /\.(?:mjs|js|cjs|ts|tsx|jsx)$/u.test(filePath));
    const filesAnalyzed = files.map(filePath => analyzeFile(this.cwd, filePath));
    const complexityDelta = Math.min(6, filesAnalyzed.reduce((max, item) => Math.max(max, item.complexityDelta), 0));
    const risk = riskFor(complexityDelta);
    const findings = filesAnalyzed.flatMap(item => item.findings);
    return {
      complexityDelta,
      risk,
      filesAnalyzed,
      findings,
      recommendations: findings.length > 0
        ? ['Split mixed responsibilities before adding more behavior to high-complexity files.']
        : [],
    };
  }
}
