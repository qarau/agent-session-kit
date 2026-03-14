function normalize(value) {
  return String(value ?? '').trim();
}

export class SuperpowersSkillAllowlist {
  constructor(skills = []) {
    this.skills = new Set((Array.isArray(skills) ? skills : []).map(skill => normalize(skill)).filter(Boolean));
  }

  list() {
    return Array.from(this.skills);
  }

  isAllowed(skillId) {
    return this.skills.has(normalize(skillId));
  }

  assertAllowed(skillId) {
    const normalized = normalize(skillId);
    if (!this.isAllowed(normalized)) {
      return {
        ok: false,
        code: 'skill-not-allowed',
        message: `skill not allowed by enterprise policy: ${normalized}`,
        skill: normalized,
      };
    }

    return {
      ok: true,
      skill: normalized,
    };
  }
}
