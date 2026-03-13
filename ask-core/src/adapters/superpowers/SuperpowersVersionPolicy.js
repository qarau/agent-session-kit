function normalize(value) {
  return String(value ?? '').trim();
}

export class SuperpowersVersionPolicy {
  constructor(options = {}) {
    this.approvedVersions = Array.isArray(options.approvedVersions) ? [...options.approvedVersions] : [];
    this.defaultVersion = normalize(options.defaultVersion);
  }

  resolve(inputVersion = '') {
    const candidate = normalize(inputVersion) || this.defaultVersion;
    if (!candidate) {
      return {
        ok: false,
        code: 'provider-version-required',
        message: 'workflow provider version must be pinned',
      };
    }

    if (!this.approvedVersions.includes(candidate)) {
      return {
        ok: false,
        code: 'provider-version-not-approved',
        message: `workflow provider version is not approved: ${candidate}`,
        version: candidate,
      };
    }

    return {
      ok: true,
      version: candidate,
    };
  }
}
