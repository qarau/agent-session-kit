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

function importSpecifiers(source = '') {
  const specs = [];
  const pattern = /(?:import\s+(?:[^'"]+\s+from\s+)?|export\s+[^'"]+\s+from\s+|import\s*\()\s*['"]([^'"]+)['"]/gu;
  let match = pattern.exec(source);
  while (match) {
    specs.push(normalize(match[1]));
    match = pattern.exec(source);
  }
  return specs.filter(Boolean);
}

function isCoreFile(filePath) {
  return normalizePath(filePath).includes('/src/core/');
}

function leaksInfrastructure(specifier = '') {
  return /(?:^|\/)(?:adapters|cli|infra|infrastructure|providers)(?:\/|$)/iu.test(specifier);
}

function vendorSignals(source = '') {
  return Array.from(source.matchAll(/\b(?:Firebase|Firestore|Supabase|Prisma|DynamoDB|S3|Stripe|OpenAI|Anthropic)[A-Za-z0-9_$]*/gu))
    .map(match => match[0]);
}

function speculativeAbstractions(source = '') {
  const matches = [];
  const pattern = /export\s+(?:abstract\s+)?(?:class|interface)\s+([A-Za-z_$][\w$]*(?:Factory|Provider|Gateway|Adapter|Interface|Strategy))/gu;
  let match = pattern.exec(source);
  while (match) {
    const symbol = match[1];
    const usages = Array.from(source.matchAll(new RegExp(`\\b${symbol}\\b`, 'gu'))).length;
    if (usages <= 1) {
      matches.push(symbol);
    }
    match = pattern.exec(source);
  }
  return matches;
}

function stripRegexLiterals(source = '') {
  return source.replace(/\/(?:\\.|[^/\r\n])+\/[dgimsuvy]*/gu, '');
}

function riskFor(violations = [], warnings = []) {
  if (violations.length > 0) {
    return 'high';
  }
  if (warnings.length > 0) {
    return 'medium';
  }
  return 'low';
}

export class OhderReplaceabilityAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : []).filter(isSourceFile);
    const filesAnalyzed = [];
    const violations = [];
    const yagniWarnings = [];

    for (const filePath of files) {
      const source = readFileSafe(this.cwd, filePath);
      const decisionSource = stripRegexLiterals(source);
      const imports = importSpecifiers(source);
      const vendors = vendorSignals(decisionSource);
      const speculative = speculativeAbstractions(decisionSource);
      if (isCoreFile(filePath)) {
        for (const specifier of imports.filter(leaksInfrastructure)) {
          violations.push({
            filePath,
            kind: 'core-infrastructure-leakage',
            severity: 'high',
            reason: `core runtime imports infrastructure boundary ${specifier}`,
          });
        }
        if (vendors.length > 0) {
          violations.push({
            filePath,
            kind: 'vendor-specific-runtime-decision',
            severity: 'high',
            reason: `core runtime contains vendor-specific decision signal ${Array.from(new Set(vendors)).join(', ')}`,
          });
        }
      }
      for (const symbol of speculative) {
        yagniWarnings.push({
          filePath,
          kind: 'unused-speculative-abstraction',
          severity: 'medium',
          symbol,
          reason: `speculative abstraction ${symbol} has no current call site`,
        });
      }
      filesAnalyzed.push({
        filePath,
        imports,
        vendorSignals: Array.from(new Set(vendors)),
        speculativeAbstractions: speculative,
      });
    }

    const risk = riskFor(violations, yagniWarnings);
    const findings = [...violations, ...yagniWarnings].map(item => `${item.reason}: ${item.filePath}`);
    return {
      risk,
      replaceabilityValid: violations.length === 0,
      yagniRisk: yagniWarnings.length > 0 ? 'medium' : 'low',
      filesAnalyzed,
      violations,
      yagniWarnings,
      findings,
      recommendations: findings.length > 0
        ? ['Keep core runtime vendor-neutral and remove abstractions until there is a current call site.']
        : [],
    };
  }
}
