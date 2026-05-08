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

function isApprovedEventAuthority(filePath) {
  const normalized = normalizePath(filePath);
  return [
    '/src/runtime/EventLedger.js',
    '/src/runtime/RuntimeProjectionEngine.js',
    '/src/runtime/RuntimeSnapshotStore.js',
    '/src/runtime/SequenceStore.js',
    '/src/fs/FileStore.js',
  ].some(authorityPath => normalized.endsWith(authorityPath));
}

function detectsDirectSyncOverwrite(source = '') {
  return [
    /\bcollection\s*\([^)]*\)\s*\.doc\s*\([^)]*\)\s*\.(?:set|update|delete)\s*\(/u,
    /\bdoc\s*\([^)]*\)\s*\.(?:set|update|delete)\s*\(/u,
    /\bfrom\s*\([^)]*\)\s*\.(?:upsert|update|delete|insert)\s*\(/u,
    /\b(?:put|patch|post)\s*\([^)]*(?:state|snapshot|projection|task|session)[^)]*\)/iu,
    /\b(?:sync|overwrite|replace).*state\b/iu,
  ].some(pattern => pattern.test(source));
}

export class OhderEventOnlySyncAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : []);
    const approvedAuthorities = [];
    const violations = [];

    for (const filePath of files) {
      const approved = isApprovedEventAuthority(filePath);
      if (approved) {
        approvedAuthorities.push(filePath);
      }
      const source = readFileSafe(this.cwd, filePath);
      if (!approved && detectsDirectSyncOverwrite(source)) {
        violations.push({
          filePath,
          kind: 'direct-non-event-sync-mutation',
          severity: 'critical',
          reason: 'direct sync mutation bypasses event ledger or projection authority',
        });
      }
    }

    const findings = violations.map(item => `${item.reason}: ${item.filePath}`);
    return {
      risk: violations.length > 0 ? 'high' : 'low',
      eventOnlySyncValid: violations.length === 0,
      approvedAuthorities,
      violations,
      findings,
      recommendations: violations.length > 0
        ? ['Route synchronization through EventLedger and replayable projection authorities before mutating runtime state.']
        : [],
    };
  }
}
