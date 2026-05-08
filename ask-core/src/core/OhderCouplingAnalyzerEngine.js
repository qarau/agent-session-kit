import fs from 'node:fs';
import path from 'node:path';

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function unique(values = []) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function layerFor(filePath = '') {
  const normalized = normalizePath(filePath);
  if (normalized.includes('/src/cli/')) {
    return 'cli';
  }
  if (normalized.includes('/src/runtime/')) {
    return 'runtime';
  }
  if (normalized.includes('/src/policy/')) {
    return 'policy';
  }
  if (normalized.includes('/src/fs/')) {
    return 'fs';
  }
  if (normalized.includes('/src/adapters/')) {
    return 'adapters';
  }
  if (normalized.includes('/src/core/')) {
    return 'core';
  }
  if (normalized.includes('/tests/')) {
    return 'tests';
  }
  if (normalized.startsWith('docs/') || normalized.includes('/docs/')) {
    return 'docs';
  }
  return 'unknown';
}

function readFileSafe(cwd, filePath) {
  const absolute = path.resolve(cwd, normalizePath(filePath));
  try {
    return fs.readFileSync(absolute, 'utf8');
  } catch {
    return '';
  }
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

function resolveImportPath(filePath, specifier) {
  const spec = normalize(specifier);
  if (!spec.startsWith('.')) {
    return '';
  }
  const base = path.posix.dirname(normalizePath(filePath));
  return normalizePath(path.posix.normalize(path.posix.join(base, spec)));
}

function isRiskyDirection(fromLayer, toLayer) {
  if (!fromLayer || !toLayer || fromLayer === toLayer || toLayer === 'unknown') {
    return false;
  }
  if (fromLayer === 'core' && ['cli', 'adapters'].includes(toLayer)) {
    return true;
  }
  if (fromLayer === 'runtime' && toLayer === 'cli') {
    return true;
  }
  if (fromLayer === 'policy' && ['cli', 'core'].includes(toLayer)) {
    return true;
  }
  return false;
}

export class OhderCouplingAnalyzerEngine {
  constructor(cwd) {
    this.cwd = cwd;
  }

  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles.map(normalizePath) : []);
    const touchedLayers = {};
    const crossLayerImports = [];
    for (const filePath of files) {
      const fromLayer = layerFor(filePath);
      touchedLayers[fromLayer] = (touchedLayers[fromLayer] ?? 0) + 1;
      const source = readFileSafe(this.cwd, filePath);
      for (const specifier of importSpecifiers(source)) {
        const resolved = resolveImportPath(filePath, specifier);
        const toLayer = layerFor(resolved);
        if (isRiskyDirection(fromLayer, toLayer)) {
          crossLayerImports.push({
            filePath,
            import: specifier,
            fromLayer,
            toLayer,
            reason: `${fromLayer} imports ${toLayer}`,
          });
        }
      }
    }

    const boundarySpread = Object.keys(touchedLayers).filter(layer => layer !== 'unknown').length;
    const couplingDelta = Math.max(
      crossLayerImports.length,
      boundarySpread >= 5 ? 3 : boundarySpread >= 3 ? 2 : boundarySpread >= 2 ? 1 : 0
    );
    const risk = couplingDelta >= 3 ? 'high' : couplingDelta >= 1 ? 'medium' : 'low';
    const findings = crossLayerImports.map(item => `${item.reason}: ${item.filePath} -> ${item.import}`);
    return {
      couplingDelta,
      risk,
      boundarySpread,
      touchedLayers,
      crossLayerImports,
      hotspotFiles: files.filter(filePath => crossLayerImports.some(item => item.filePath === filePath)),
      findings,
      recommendations: findings.length > 0
        ? ['Invert the dependency or extract a shared core contract.']
        : [],
    };
  }
}
