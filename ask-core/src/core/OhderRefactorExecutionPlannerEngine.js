import crypto from 'node:crypto';

function normalize(value) {
  return String(value ?? '').trim();
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(entry => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprintFor(payload) {
  return crypto.createHash('sha256').update(stableStringify(payload), 'utf8').digest('hex').slice(0, 12);
}

function isDocTarget(target = {}) {
  const type = normalize(target.type).toLowerCase();
  const path = normalize(target.path);
  return type.includes('doc') || /\.md$/u.test(path);
}

function targetPath(recommendation = {}) {
  return normalize(recommendation?.target?.path) || normalize(recommendation?.target?.targetId);
}

function couplingActions(architect = {}) {
  const imports = Array.isArray(architect?.couplingAnalysis?.crossLayerImports)
    ? architect.couplingAnalysis.crossLayerImports
    : [];
  return imports.map(item => ({
    type: 'reduce-cross-layer-import',
    targetPath: normalize(item.filePath),
    fromLayer: normalize(item.fromLayer),
    toLayer: normalize(item.toLayer),
    steps: [
      'Identify the boundary responsibility being imported across layers.',
      'Move the dependency behind a lower-level interface or shared core contract.',
      'Re-run architect validation and coupling analysis.',
    ],
  }));
}

function complexityActions(architect = {}) {
  const analysis = architect?.complexityAnalysis;
  if (!analysis || normalize(analysis.risk).toLowerCase() === 'low') {
    return [];
  }
  const files = Array.isArray(analysis.filesAnalyzed) ? analysis.filesAnalyzed : [];
  return files
    .filter(file => normalize(file.filePath))
    .slice(0, 3)
    .map(file => ({
      type: 'extract-responsibility',
      targetPath: normalize(file.filePath),
      steps: [
        'Name the mixed responsibility before editing.',
        'Extract one responsibility into a new runtime-owned module.',
        'Keep behavior stable with focused contract tests.',
      ],
    }));
}

export class OhderRefactorExecutionPlannerEngine {
  plan({ recommendation = {}, architect = {} } = {}) {
    const target = recommendation?.target && typeof recommendation.target === 'object'
      ? recommendation.target
      : {};
    const actions = [];
    const path = targetPath(recommendation);

    if (isDocTarget(target)) {
      actions.push({
        type: 'split-doc-section',
        targetPath: path,
        steps: [
          'Identify the stale or overloaded section.',
          'Split runtime detail into the operations docs and keep README as orientation.',
          'Add a short cross-link from the source section to the detailed document.',
        ],
      });
    }

    actions.push(...couplingActions(architect));
    actions.push(...complexityActions(architect));

    if (actions.length < 1) {
      actions.push({
        type: 'governed-refactor-slice',
        targetPath: path,
        steps: [
          'Define the smallest behavior-preserving refactor scope.',
          'Run ASK slice validation after the change.',
          'Commit only after OHDER governance passes.',
        ],
      });
    }

    const highRisk = actions.some(action => action.type === 'reduce-cross-layer-import')
      || normalize(architect?.complexityAnalysis?.risk).toLowerCase() === 'high'
      || normalize(architect?.authorityAnalysis?.risk).toLowerCase() === 'high';
    const risk = highRisk ? 'high' : actions.length > 1 ? 'medium' : 'low';
    const payload = {
      schemaVersion: 1,
      risk,
      approvalRequired: risk === 'high',
      actions,
      validation: [
        'Run targeted tests for the changed boundary.',
        'Run ASK slice close so OHDER architect validation re-measures the slice.',
      ],
    };
    return {
      planId: `ohder-refactor-plan-${fingerprintFor(payload)}`,
      ...payload,
    };
  }
}
