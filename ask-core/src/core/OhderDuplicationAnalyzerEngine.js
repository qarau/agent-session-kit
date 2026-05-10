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

function normalizeLine(line = '') {
  return normalize(line)
    .replace(/\s+/gu, ' ')
    .replace(/;$/u, '');
}

function isBoilerplateLine(line = '') {
  const normalized = normalizeLine(line);
  if (!normalized) {
    return true;
  }
  return [
    /^\/\/|^\/\*|^\*/u,
    /^import\b/u,
    /^export\s+(?:const|let|var)\s+[A-Z0-9_]+\s*=/u,
    /^export\s+class\s+\w+\s*\{\s*\}$/u,
    /^[{}()[\],;]+$/u,
  ].some(pattern => pattern.test(normalized));
}

function meaningfulLines(source = '') {
  return source
    .split(/\r?\n/u)
    .map((line, index) => ({
      line: index + 1,
      text: normalizeLine(line),
    }))
    .filter(item => !isBoilerplateLine(item.text));
}

function shingles(lines = [], size = 6) {
  if (lines.length < size) {
    return [];
  }
  const result = [];
  for (let index = 0; index <= lines.length - size; index += 1) {
    const window = lines.slice(index, index + size);
    result.push({
      key: window.map(item => item.text).join('\n'),
      startLine: window[0].line,
      lineCount: window.length,
      excerpt: window.slice(0, 3).map(item => item.text).join(' / '),
    });
  }
  return result;
}

function riskFor(groups = []) {
  if (groups.some(group => group.duplicateLines >= 8) || groups.length >= 2) {
    return 'high';
  }
  if (groups.length > 0) {
    return 'medium';
  }
  return 'low';
}

export class OhderDuplicationAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : [])
      .filter(filePath => isAnalyzableSourceFile(filePath));
    const byShingle = new Map();

    for (const filePath of files) {
      const source = readFileSafe(this.cwd, filePath);
      for (const shingle of shingles(meaningfulLines(source))) {
        const occurrences = byShingle.get(shingle.key) || [];
        occurrences.push({
          filePath,
          startLine: shingle.startLine,
          lineCount: shingle.lineCount,
          excerpt: shingle.excerpt,
        });
        byShingle.set(shingle.key, occurrences);
      }
    }

    const merged = new Map();
    for (const occurrences of byShingle.values()) {
      const filesInGroup = Array.from(new Set(occurrences.map(item => item.filePath))).sort();
      if (filesInGroup.length < 2) {
        continue;
      }
      const key = filesInGroup.join('|');
      const existing = merged.get(key) || {
        files: filesInGroup,
        occurrences: [],
        duplicateLines: 0,
        excerpt: '',
      };
      existing.occurrences.push(...occurrences);
      const shingleSize = occurrences[0]?.lineCount || 0;
      const estimatedBlockLines = shingleSize + Math.max(0, Math.floor(existing.occurrences.length / filesInGroup.length) - 1);
      existing.duplicateLines = Math.max(existing.duplicateLines, estimatedBlockLines);
      existing.excerpt ||= occurrences[0]?.excerpt || '';
      merged.set(key, existing);
    }

    const duplicateGroups = Array.from(merged.values()).map(group => ({
      files: group.files,
      occurrences: group.occurrences,
      duplicateLines: group.duplicateLines,
      excerpt: group.excerpt,
    }));
    const risk = riskFor(duplicateGroups);
    const findings = duplicateGroups.map(group => {
      return `duplicated logic across ${group.files.join(', ')} (${String(group.duplicateLines)}+ lines)`;
    });

    return {
      risk,
      duplicationValid: duplicateGroups.length === 0,
      filesAnalyzed: files,
      duplicateGroups,
      findings,
      recommendations: duplicateGroups.length > 0
        ? ['Extract shared behavior or centralize the policy path instead of copying logic across runtime layers.']
        : [],
    };
  }
}
