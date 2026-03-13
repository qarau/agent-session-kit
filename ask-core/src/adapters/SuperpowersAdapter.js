import { WorkflowAdapter } from './WorkflowAdapter.js';
import { SuperpowersVersionPolicy } from './superpowers/SuperpowersVersionPolicy.js';
import { SuperpowersSkillAllowlist } from './superpowers/SuperpowersSkillAllowlist.js';
import { SuperpowersCompatibilityHarness } from './superpowers/SuperpowersCompatibilityHarness.js';

const SKILLS = {
  PLAN: 'writing-plans',
  EXECUTE: 'executing-plans',
  VERIFY: 'verification-before-completion',
};

function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeSkill(value) {
  return normalize(value).toLowerCase();
}

function policyError(payload) {
  const error = new Error(String(payload?.message ?? 'workflow provider policy error'));
  error.name = 'WorkflowProviderPolicyError';
  error.code = String(payload?.code ?? 'workflow-provider-policy-error');
  error.details = payload ?? {};
  return error;
}

export class SuperpowersAdapter extends WorkflowAdapter {
  constructor(options = {}) {
    super('superpowers', [SKILLS.PLAN, SKILLS.EXECUTE, SKILLS.VERIFY]);

    const hasProviderVersion = Object.prototype.hasOwnProperty.call(options, 'providerVersion');
    const hasDefaultVersion = Object.prototype.hasOwnProperty.call(options, 'defaultVersion');
    this.providerEnabled = options.enabled !== false;
    this.providerVersion = hasProviderVersion ? normalize(options.providerVersion) : '0.3.0';
    const defaultVersion = hasDefaultVersion ? normalize(options.defaultVersion) : this.providerVersion;
    this.versionPolicy = options.versionPolicy ?? new SuperpowersVersionPolicy({
      approvedVersions: Array.isArray(options.approvedVersions) ? options.approvedVersions : ['0.3.0'],
      defaultVersion,
    });
    this.skillAllowlist = options.skillAllowlist ?? new SuperpowersSkillAllowlist(
      Array.isArray(options.allowedSkills) ? options.allowedSkills : this.supportedSkills
    );
    this.compatibilityHarness = options.compatibilityHarness ?? new SuperpowersCompatibilityHarness(
      options.compatibilityMatrix ?? { '0.3.0': true }
    );
    this.fallbackSkill = normalizeSkill(options.fallbackSkill) || SKILLS.EXECUTE;
  }

  recommend(input) {
    if (!this.providerEnabled) {
      return this.fallbackRecommendation('provider-disabled', 'workflow provider disabled by policy');
    }

    const provider = this.validateProviderVersion(this.providerVersion);
    const task = input?.task ?? {};
    const verification = input?.verification ?? null;
    const status = String(task.status ?? '').trim().toLowerCase();

    const recommendation = this.recommendByState(status, verification);
    const allowResult = this.skillAllowlist.assertAllowed(recommendation.skill);
    if (!allowResult.ok) {
      throw policyError(allowResult);
    }

    return {
      ...recommendation,
      providerVersion: provider.version,
    };
  }

  providerStatus(version = '') {
    if (!this.providerEnabled) {
      return {
        ok: true,
        workflow: this.workflowName,
        status: 'disabled',
        code: 'provider-disabled',
        version: normalize(version) || this.providerVersion,
        fallbackSkill: this.resolveFallbackSkill(),
      };
    }

    const resolved = this.versionPolicy.resolve(normalize(version) || this.providerVersion);
    if (!resolved.ok) {
      return {
        ok: false,
        workflow: this.workflowName,
        status: 'invalid-version',
        ...resolved,
      };
    }

    const compatibility = this.compatibilityHarness.check(resolved.version);
    if (!compatibility.ok) {
      return {
        ok: false,
        workflow: this.workflowName,
        status: 'incompatible',
        ...compatibility,
      };
    }

    return {
      ok: true,
      workflow: this.workflowName,
      status: 'compatible',
      version: resolved.version,
    };
  }

  validateProviderVersion(version) {
    const resolved = this.versionPolicy.resolve(version);
    if (!resolved.ok) {
      throw policyError(resolved);
    }

    const compatibility = this.compatibilityHarness.check(resolved.version);
    if (!compatibility.ok) {
      throw policyError(compatibility);
    }

    return resolved;
  }

  recommendByState(status, verification) {
    if (status === 'created') {
      return {
        workflow: this.workflowName,
        skill: SKILLS.PLAN,
        reason: 'Task is newly created and needs implementation planning.',
      };
    }

    if (status === 'completed' && verification?.status !== 'passed') {
      return {
        workflow: this.workflowName,
        skill: SKILLS.VERIFY,
        reason: 'Task is completed but verification is not yet passed.',
      };
    }

    return {
      workflow: this.workflowName,
      skill: SKILLS.EXECUTE,
      reason: 'Task is active; continue implementation execution.',
    };
  }

  resolveFallbackSkill() {
    const fallback = normalizeSkill(this.fallbackSkill);
    if (this.skillAllowlist.isAllowed(fallback)) {
      return fallback;
    }

    const allowlisted = this.skillAllowlist.list();
    if (allowlisted.length > 0) {
      return allowlisted[0];
    }

    return SKILLS.EXECUTE;
  }

  fallbackRecommendation(code, reason) {
    return {
      workflow: this.workflowName,
      skill: this.resolveFallbackSkill(),
      reason: String(reason ?? ''),
      fallback: true,
      code: String(code ?? 'provider-fallback'),
    };
  }
}
