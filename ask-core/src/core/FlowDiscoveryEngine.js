function normalize(value) {
  return String(value ?? '').trim();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function nowIso() {
  return new Date().toISOString();
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

function toTitleCase(value) {
  return value
    .split(/\s+/u)
    .map(token => token ? token[0].toUpperCase() + token.slice(1).toLowerCase() : token)
    .join(' ')
    .trim();
}

function humanNameForFile(filePath) {
  const base = basenameNoExt(filePath);
  const spaced = base
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[-_]+/gu, ' ')
    .trim();
  return toTitleCase(spaced || 'Runtime Flow');
}

function uniqueFlowId(preferredId, existingIds) {
  if (!existingIds.has(preferredId)) {
    existingIds.add(preferredId);
    return preferredId;
  }
  let index = 2;
  while (existingIds.has(`${preferredId}-${String(index)}`)) {
    index += 1;
  }
  const resolved = `${preferredId}-${String(index)}`;
  existingIds.add(resolved);
  return resolved;
}

function collectMappedPatterns(flowMap = {}) {
  const patterns = [];
  for (const value of Object.values(flowMap)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const files = Array.isArray(value.files) ? value.files : [];
    for (const filePattern of files) {
      const normalized = normalizePath(filePattern);
      if (normalized) {
        patterns.push(normalized);
      }
    }
  }
  return patterns;
}

function matchingTestsForFile(testsRun = [], filePath = '') {
  const token = basenameNoExt(filePath).toLowerCase();
  if (!token) {
    return [];
  }
  const matches = testsRun
    .map(item => normalize(item))
    .filter(Boolean)
    .filter(item => item.toLowerCase().includes(token));
  return Array.from(new Set(matches));
}

export class FlowDiscoveryEngine {
  discoverFromEvidence({ contract = {}, flowMap = {}, execution = {}, validation = {}, policy = {} }) {
    if (policy?.flow?.discovery_enabled === false) {
      return {
        discovered: [],
        skippedMappedFiles: [],
        examinedFiles: [],
        reason: 'flow discovery disabled by policy',
      };
    }

    const touchedFiles = Array.isArray(execution.touchedFiles)
      ? execution.touchedFiles.map(value => normalizePath(value)).filter(Boolean)
      : [];
    const uniqueTouched = Array.from(new Set(touchedFiles)).sort();
    const mappedPatterns = collectMappedPatterns(flowMap);
    const testsRun = Array.isArray(validation.testsRun) ? validation.testsRun : [];
    const existingIds = new Set(
      (Array.isArray(contract.flows) ? contract.flows : [])
        .map(flow => normalize(flow?.id))
        .filter(Boolean)
    );

    const discovered = [];
    const skippedMappedFiles = [];
    const discoveredAt = nowIso();

    for (const filePath of uniqueTouched) {
      const alreadyMapped = mappedPatterns.some(pattern => matchPattern(filePath, pattern));
      if (alreadyMapped) {
        skippedMappedFiles.push(filePath);
        continue;
      }

      const stem = slugify(normalizePath(filePath).replace(/\.[^./\\]+$/u, ''));
      const preferredId = `auto-${stem || 'flow'}-flow`;
      const flowId = uniqueFlowId(preferredId, existingIds);
      const name = humanNameForFile(filePath);
      const tests = matchingTestsForFile(testsRun, filePath);
      discovered.push({
        flow: {
          id: flowId,
          name,
          stage: 'experimental',
          criticality: 'experimental',
          given: `Code path ${filePath} is modified`,
          when: `Runtime executes changes touching ${filePath}`,
          then: [
            `${name} behavior remains stable`,
          ],
          mustNever: [],
          lifecycle: {
            discoveredAt,
            discoveredBy: 'flow-discovery-engine',
            sourceFile: filePath,
          },
          updatedAt: discoveredAt,
        },
        map: {
          files: [filePath],
          tests,
        },
      });
    }

    return {
      discovered,
      skippedMappedFiles,
      examinedFiles: uniqueTouched,
      reason: discovered.length > 0 ? 'discovered-experimental-flows' : 'no-unmapped-runtime-files',
    };
  }
}

