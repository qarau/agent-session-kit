import fs from 'node:fs';
import { PolicyEngine } from './PolicyEngine.js';
import { GovernanceBypassFindingEngine } from './GovernanceBypassFindingEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function parseList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map(entry => normalize(entry).toLowerCase()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(entry => normalize(entry).toLowerCase()).filter(Boolean);
  }
  return [...fallback].map(entry => normalize(entry).toLowerCase()).filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export class CommitMessageCheckEngine {
  constructor(cwd) {
    this.cwd = cwd;
    this.policyEngine = new PolicyEngine(cwd);
    this.bypassFindings = new GovernanceBypassFindingEngine(cwd);
  }

  parseFooters(message, sliceFooterKey, exemptFooterKey) {
    const text = String(message ?? '');
    const slicePattern = new RegExp(`^\\s*${escapeRegExp(sliceFooterKey)}:\\s*(\\S+)\\s*$`, 'gmi');
    const exemptPattern = new RegExp(`^\\s*${escapeRegExp(exemptFooterKey)}:\\s*(\\S+)\\s*$`, 'gmi');
    return {
      sliceIds: Array.from(text.matchAll(slicePattern)).map(match => normalize(match[1])),
      exemptKinds: Array.from(text.matchAll(exemptPattern)).map(match => normalize(match[1]).toLowerCase()),
    };
  }

  async run(messagePath = '') {
    const resolvedPath = normalize(messagePath);
    if (!resolvedPath) {
      return {
        passed: false,
        missing: ['commit message file is required'],
        checks: ['commit-message-provenance'],
        sliceIds: [],
        exemptKinds: [],
      };
    }
    if (!fs.existsSync(resolvedPath)) {
      return {
        passed: false,
        missing: [`commit message file not found: ${resolvedPath}`],
        checks: ['commit-message-provenance'],
        sliceIds: [],
        exemptKinds: [],
      };
    }

    const policy = await this.policyEngine.load();
    const section = policy.slice_commit ?? {};
    if (section.enabled === false) {
      return {
        passed: true,
        missing: [],
        checks: ['commit-message-provenance'],
        sliceIds: [],
        exemptKinds: [],
        disabled: true,
      };
    }

    const sliceFooterKey = normalize(section.footer_key) || 'ASK-Slice';
    const exemptFooterKey = normalize(section.exempt_footer_key) || 'ASK-Exempt';
    const allowedExemptions = new Set(parseList(section.allowed_exemptions, ['release', 'meta']));
    const message = fs.readFileSync(resolvedPath, 'utf8');
    const { sliceIds, exemptKinds } = this.parseFooters(message, sliceFooterKey, exemptFooterKey);
    const missing = [];

    if (sliceIds.length > 1) {
      missing.push(`commit message has multiple ${sliceFooterKey} footers`);
    }
    if (exemptKinds.length > 1) {
      missing.push(`commit message has multiple ${exemptFooterKey} footers`);
    }
    if (sliceIds.length > 0 && exemptKinds.length > 0) {
      missing.push(`commit message cannot include both ${sliceFooterKey} and ${exemptFooterKey}`);
    }
    if (sliceIds.length === 1 && !sliceIds[0]) {
      missing.push(`commit message has invalid ${sliceFooterKey} value`);
    }
    if (exemptKinds.length === 1 && !allowedExemptions.has(exemptKinds[0])) {
      missing.push(`commit message has invalid ${exemptFooterKey} value: ${exemptKinds[0]}`);
    }
    if (sliceIds.length === 0 && exemptKinds.length === 0) {
      missing.push(`commit message missing ${sliceFooterKey} footer or ${exemptFooterKey} exemption`);
    }

    let findings = [];
    if (missing.length > 0) {
      const findingResult = await this.bypassFindings.report({
        bypassType: 'invalid commit provenance',
        severity: 'critical',
        message: missing.join('; '),
        evidence: [
          {
            filePath: resolvedPath,
            reason: `invalid commit provenance: ${missing.join('; ')}`,
          },
        ],
        recommendations: [`Add ${sliceFooterKey}: <taskId> or a valid ${exemptFooterKey}: <kind> footer.`],
      });
      findings = Array.isArray(findingResult.findings) ? findingResult.findings : [];
    }

    return {
      passed: missing.length === 0,
      missing,
      checks: ['commit-message-provenance'],
      sliceFooterKey,
      exemptFooterKey,
      sliceIds,
      exemptKinds,
      findings,
    };
  }
}
