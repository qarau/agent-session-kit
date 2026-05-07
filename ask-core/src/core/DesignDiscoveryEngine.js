function normalize(value) {
  return String(value ?? '').trim();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
}

function matchPattern(filePath, pattern) {
  const normalizedFilePath = normalizePath(filePath);
  const normalizedPattern = normalizePath(pattern);
  if (!normalizedPattern) {
    return false;
  }
  if (!normalizedPattern.includes('*')) {
    return normalizedFilePath === normalizedPattern || normalizedFilePath.endsWith(`/${normalizedPattern}`);
  }
  const token = '__ASK_GLOBSTAR__';
  const prepared = escapeRegex(normalizedPattern)
    .replace(/\*\*/gu, token)
    .replace(/\*/gu, '[^/]*')
    .replace(new RegExp(token, 'gu'), '.*');
  const regex = new RegExp(`^${prepared}$`, 'u');
  return regex.test(normalizedFilePath) || regex.test(normalizedFilePath.replace(/^\.?\//u, ''));
}

function slugify(value) {
  return normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function basenameNoExt(filePath) {
  const normalized = normalizePath(filePath);
  const leaf = normalized.split('/').filter(Boolean).at(-1) || normalized;
  return leaf.replace(/\.[^./\\]+$/u, '');
}

function titleFromFile(filePath) {
  const stem = basenameNoExt(filePath)
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[-_]+/gu, ' ')
    .trim();
  return stem
    .split(/\s+/u)
    .filter(Boolean)
    .map(token => token[0].toUpperCase() + token.slice(1).toLowerCase())
    .join(' ');
}

function uniqueId(preferredId, used) {
  if (!used.has(preferredId)) {
    used.add(preferredId);
    return preferredId;
  }
  let suffix = 2;
  while (used.has(`${preferredId}-${String(suffix)}`)) {
    suffix += 1;
  }
  const resolved = `${preferredId}-${String(suffix)}`;
  used.add(resolved);
  return resolved;
}

function mapPatterns(visualMap = {}) {
  const patterns = [];
  for (const entry of Object.values(visualMap)) {
    const files = Array.isArray(entry?.files) ? entry.files : [];
    for (const pattern of files) {
      const normalized = normalizePath(pattern);
      if (normalized) {
        patterns.push(normalized);
      }
    }
  }
  return patterns;
}

export class DesignDiscoveryEngine {
  discoverFromEvidence({ visualMap = {}, execution = {}, policy = {} }) {
    if (policy?.design?.discovery_enabled === false) {
      return {
        discovered: [],
        examinedFiles: [],
        skippedMappedFiles: [],
        reason: 'design discovery disabled by policy',
      };
    }

    const touchedFiles = Array.isArray(execution.touchedFiles)
      ? execution.touchedFiles.map(value => normalizePath(value)).filter(Boolean)
      : [];
    const examinedFiles = Array.from(new Set(touchedFiles)).sort();
    const patterns = mapPatterns(visualMap);
    const usedIds = new Set(Object.keys(visualMap || {}).map(key => normalize(key)).filter(Boolean));
    const discovered = [];
    const skippedMappedFiles = [];

    for (const filePath of examinedFiles) {
      const mapped = patterns.some(pattern => matchPattern(filePath, pattern));
      if (mapped) {
        skippedMappedFiles.push(filePath);
        continue;
      }
      const stem = slugify(filePath.replace(/\.[^./\\]+$/u, ''));
      const regionId = uniqueId(`auto-${stem || 'visual-region'}`, usedIds);
      discovered.push({
        id: regionId,
        name: titleFromFile(filePath) || 'Discovered Visual Region',
        files: [filePath],
        protectedRules: [],
        status: 'exploratory',
        sourceFile: filePath,
      });
    }

    return {
      discovered,
      examinedFiles,
      skippedMappedFiles,
      reason: discovered.length > 0 ? 'discovered-visual-regions' : 'no-unmapped-visual-files',
    };
  }
}

