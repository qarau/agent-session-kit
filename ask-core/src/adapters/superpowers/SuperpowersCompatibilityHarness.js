function normalize(value) {
  return String(value ?? '').trim();
}

export class SuperpowersCompatibilityHarness {
  constructor(matrix = {}) {
    this.matrix = { ...matrix };
  }

  check(version) {
    const normalizedVersion = normalize(version);
    if (!normalizedVersion) {
      return {
        ok: false,
        code: 'provider-version-required',
        message: 'provider version is required for compatibility check',
      };
    }

    if (!(normalizedVersion in this.matrix)) {
      return {
        ok: false,
        code: 'provider-version-unknown',
        version: normalizedVersion,
        message: `provider version is unknown to compatibility harness: ${normalizedVersion}`,
      };
    }

    const compatible = this.matrix[normalizedVersion] === true;
    if (!compatible) {
      return {
        ok: false,
        code: 'provider-version-incompatible',
        version: normalizedVersion,
        message: `provider version failed compatibility checks: ${normalizedVersion}`,
      };
    }

    return {
      ok: true,
      version: normalizedVersion,
    };
  }
}
