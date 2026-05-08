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

function isApprovedAuthority(filePath) {
  const normalized = normalizePath(filePath);
  return [
    '/src/runtime/RuntimeSnapshotStore.js',
    '/src/runtime/RuntimeProjectionEngine.js',
    '/src/runtime/EventLedger.js',
    '/src/runtime/SequenceStore.js',
    '/src/fs/FileStore.js',
    '/src/fs/Scaffolder.js',
  ].some(authorityPath => normalized.endsWith(authorityPath));
}

function governedTargets(source = '') {
  const targets = new Set();
  const pathMethodPattern = /paths\.([A-Za-z0-9_]*(?:Snapshot|State|Events|Packet|Metrics|Analytics|Registry))\s*\(/gu;
  let match = pathMethodPattern.exec(source);
  while (match) {
    targets.add(match[1]);
    match = pathMethodPattern.exec(source);
  }

  const literalPattern = /\.(?:ask|ask[\\/]+runtime|runtime[\\/]+snapshots)[^'"`)]*/giu;
  match = literalPattern.exec(source);
  while (match) {
    targets.add(match[0].replace(/\\/gu, '/'));
    match = literalPattern.exec(source);
  }
  return Array.from(targets);
}

function detectsWrite(source = '') {
  return /(?:writeFileSync|appendFileSync|writeFile|appendFile|writeJson|appendNdjson)\s*\(/u.test(source);
}

export class OhderSsotAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : []);
    const authoritiesByTarget = new Map();
    const approvedAuthorities = [];

    for (const filePath of files) {
      const source = readFileSafe(this.cwd, filePath);
      if (!detectsWrite(source)) {
        continue;
      }
      const targets = governedTargets(source);
      if (targets.length < 1) {
        continue;
      }
      const approved = isApprovedAuthority(filePath);
      if (approved) {
        approvedAuthorities.push(filePath);
      }
      for (const target of targets) {
        const writers = authoritiesByTarget.get(target) || [];
        writers.push({
          filePath,
          approved,
        });
        authoritiesByTarget.set(target, writers);
      }
    }

    const violations = [];
    for (const [target, writers] of authoritiesByTarget.entries()) {
      const unapproved = writers.filter(writer => writer.approved !== true);
      if (writers.length > 1 && unapproved.length > 0) {
        violations.push({
          target,
          severity: 'critical',
          writers,
          reason: `duplicate governed-state authority for ${target}`,
        });
      }
    }

    const findings = violations.map(item => `${item.reason}: ${item.writers.map(writer => writer.filePath).join(', ')}`);
    return {
      risk: violations.length > 0 ? 'high' : 'low',
      ssotValid: violations.length === 0,
      approvedAuthorities,
      authoritiesByTarget: Object.fromEntries(authoritiesByTarget.entries()),
      violations,
      findings,
      recommendations: violations.length > 0
        ? ['Route each governed state target through one approved projection, snapshot, ledger, sequence, file-store, or scaffold authority.']
        : [],
    };
  }
}
