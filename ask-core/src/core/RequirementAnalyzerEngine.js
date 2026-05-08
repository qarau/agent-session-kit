function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function includesAny(text, patterns = []) {
  return patterns.some(pattern => pattern.test(text));
}

function addClass(classes, value) {
  const normalized = normalize(value);
  if (normalized && !classes.includes(normalized)) {
    classes.push(normalized);
  }
}

export class RequirementAnalyzerEngine {
  analyze(input = {}) {
    const touchedFiles = asArray(input.touchedFiles || input.latestExecution?.touchedFiles);
    const text = [
      input.requirement,
      input.nextRecommendedAction,
      input.goal,
      input.currentTask,
      input.title,
      input.description,
      ...touchedFiles,
    ].map(normalizeLower).filter(Boolean).join('\n');
    const classes = [];

    if (includesAny(text, [/\bfix(?:es)?\b/u, /\bbug(?:fix)?\b/u, /\bregression\b/u, /\bfail(?:ing|ed)?\b/u, /\berror\b/u])) {
      addClass(classes, 'bugfix');
    }
    if (includesAny(text, [/\brefactor\b/u, /\bextract\b/u, /\bsplit\b/u, /\bcleanup\b/u, /\bdebt\b/u])) {
      addClass(classes, 'refactor');
    }
    if (includesAny(text, [/\breadme\b/u, /\bdocs?\b/u, /\bdocumentation\b/u, /\.md\b/u])) {
      addClass(classes, 'docs');
    }
    if (includesAny(text, [/\bgovernance\b/u, /\bohder\b/u, /\bask\b/u, /\bpolicy\b/u, /\blaw\b/u, /\bentropy\b/u])) {
      addClass(classes, 'governance');
    }
    if (includesAny(text, [/\brelease\b/u, /\bversion\b/u, /\btag\b/u, /\bchangelog\b/u])) {
      addClass(classes, 'release');
    }
    if (includesAny(text, [/\bimplement\b/u, /\badd\b/u, /\bcreate\b/u, /\benable\b/u, /\bsupport\b/u, /\bfeature\b/u])) {
      addClass(classes, 'feature');
    }

    const securitySensitive = includesAny(text, [
      /\bauth\b/u,
      /\btoken\b/u,
      /\bsecret\b/u,
      /\bsecurity\b/u,
      /\bpermission\b/u,
      /\blogin\b/u,
      /\boauth\b/u,
    ]);
    const durabilitySensitive = includesAny(text, [
      /\bsnapshot\b/u,
      /\bledger\b/u,
      /\bevent\b/u,
      /\bsequence\b/u,
      /\bmigration\b/u,
      /\bschema\b/u,
      /\bpersist(?:ence|ent)?\b/u,
      /\bdatabase\b/u,
      /\bruntime-state\b/u,
    ]);
    if (securitySensitive) {
      addClass(classes, 'security-sensitive');
    }
    if (durabilitySensitive) {
      addClass(classes, 'durability-sensitive');
    }
    if (classes.length === 0) {
      addClass(classes, 'feature');
    }

    const primaryClass = ['bugfix', 'refactor', 'feature', 'release', 'governance', 'docs']
      .find(item => classes.includes(item))
      || classes.find(item => !['security-sensitive', 'durability-sensitive'].includes(item))
      || classes[0]
      || 'feature';
    return {
      primaryClass,
      classes,
      riskFlags: {
        securitySensitive,
        durabilitySensitive,
      },
      signals: classes,
    };
  }
}
