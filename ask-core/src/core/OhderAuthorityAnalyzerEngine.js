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

function detectsGovernedWrite(source = '') {
  const writes = /(?:writeFileSync|appendFileSync|writeFile|appendFile|writeJson|appendNdjson)\s*\(/u.test(source);
  const governedPath = /(?:\.ask|runtime[\\/]+snapshots|sessionSnapshot|taskBoardSnapshot|projectionState|resumePacket|runtimeEvents|sequenceState|events\.ndjson|resume\.json|projection-state\.json|sequence\.json)/u.test(source);
  return writes && governedPath;
}

export class OhderAuthorityAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : []);
    const violations = [];
    const approvedAuthorities = [];

    for (const filePath of files) {
      const approved = isApprovedAuthority(filePath);
      const source = readFileSafe(this.cwd, filePath);
      if (approved) {
        approvedAuthorities.push(filePath);
        continue;
      }
      if (detectsGovernedWrite(source)) {
        violations.push({
          filePath,
          kind: 'direct-governed-state-write',
          severity: 'high',
          reason: 'direct write to governed ASK runtime state outside approved authority',
        });
      }
    }

    const risk = violations.length > 0 ? 'high' : 'low';
    const findings = violations.map(item => `${item.reason}: ${item.filePath}`);
    return {
      risk,
      authorityValid: violations.length === 0,
      approvedAuthorities,
      violations,
      findings,
      recommendations: violations.length > 0
        ? ['Route governed state writes through RuntimeSnapshotStore, RuntimeProjectionEngine, EventLedger, or SequenceStore.']
        : [],
    };
  }
}
