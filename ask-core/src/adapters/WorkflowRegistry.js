import { SuperpowersAdapter } from './SuperpowersAdapter.js';

function normalize(name) {
  return String(name ?? '').trim().toLowerCase();
}

function list(value) {
  if (Array.isArray(value)) {
    return value.map(entry => String(entry ?? '').trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function createCompatibilityMatrix(approvedVersions, incompatibleVersions) {
  const matrix = {};
  for (const version of approvedVersions) {
    matrix[version] = true;
  }
  for (const version of incompatibleVersions) {
    matrix[version] = false;
  }
  return matrix;
}

function resolveSuperpowersOptions(policy = {}) {
  const provider = policy.workflow_provider ?? {};
  const approvedVersions = list(provider.superpowers_approved_versions);
  const incompatibleVersions = list(provider.superpowers_incompatible_versions);
  const allowlistedSkills = list(provider.superpowers_allowed_skills);

  const resolvedApprovedVersions = approvedVersions.length > 0 ? approvedVersions : ['0.3.0'];
  return {
    enabled: provider.superpowers_enabled !== false,
    providerVersion: String(provider.superpowers_version ?? '').trim() || '0.3.0',
    approvedVersions: resolvedApprovedVersions,
    allowedSkills: allowlistedSkills.length > 0 ? allowlistedSkills : undefined,
    fallbackSkill: String(provider.superpowers_fallback_skill ?? '').trim() || 'executing-plans',
    compatibilityMatrix: createCompatibilityMatrix(resolvedApprovedVersions, incompatibleVersions),
  };
}

export class WorkflowRegistry {
  constructor(options = {}) {
    const providedAdapters = Array.isArray(options)
      ? options
      : (Array.isArray(options.adapters) ? options.adapters : null);
    const adapters = providedAdapters ?? [new SuperpowersAdapter(resolveSuperpowersOptions(options.policy ?? {}))];

    this.adapters = new Map();
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter) {
    if (!adapter || typeof adapter.recommend !== 'function') {
      throw new Error('invalid workflow adapter');
    }
    const key = normalize(adapter.workflowName);
    if (!key) {
      throw new Error('workflow adapter name is required');
    }
    this.adapters.set(key, adapter);
  }

  get(workflowName) {
    const key = normalize(workflowName);
    return this.adapters.get(key) ?? null;
  }

  recommend(workflowName, input) {
    const adapter = this.get(workflowName);
    if (!adapter) {
      return null;
    }
    return adapter.recommend(input);
  }

  providerStatus(workflowName, version = '') {
    const adapter = this.get(workflowName);
    if (!adapter) {
      return null;
    }
    if (typeof adapter.providerStatus !== 'function') {
      return {
        ok: false,
        code: 'provider-status-unsupported',
        workflow: String(adapter.workflowName ?? ''),
        message: 'workflow provider does not implement providerStatus',
      };
    }
    return adapter.providerStatus(version);
  }
}
