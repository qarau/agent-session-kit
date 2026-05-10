function normalize(value) {
  return String(value ?? '').trim();
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function unique(values = []) {
  return Array.from(new Set(values.map(normalizePath).filter(Boolean)));
}

const TOUCHPOINTS = [
  {
    kind: 'projector',
    pattern: /\/runtime\/projectors\/|Projector\.(?:js|mjs|ts)$/u,
    weight: 2,
    finding: 'projector durability touchpoint',
  },
  {
    kind: 'snapshot',
    pattern: /Snapshot|snapshot|checkpoint|resume-packet/u,
    weight: 2,
    finding: 'snapshot durability touchpoint',
  },
  {
    kind: 'event-log',
    pattern: /event|ledger|sequence|append/i,
    weight: 2,
    finding: 'event or ledger durability touchpoint',
  },
  {
    kind: 'policy',
    pattern: /\/policy\/|policy-reference|ohder-law-pack/u,
    weight: 1,
    finding: 'policy durability touchpoint',
  },
  {
    kind: 'migration',
    pattern: /migration|migrate|schema/i,
    weight: 3,
    finding: 'migration durability touchpoint',
  },
];

function classify(filePath) {
  const normalized = normalizePath(filePath);
  return TOUCHPOINTS
    .filter(touchpoint => touchpoint.pattern.test(normalized))
    .map(touchpoint => ({
      filePath: normalized,
      kind: touchpoint.kind,
      weight: touchpoint.weight,
      finding: touchpoint.finding,
    }));
}

function riskFor(delta) {
  if (delta >= 5) {
    return 'high';
  }
  if (delta >= 2) {
    return 'medium';
  }
  return 'low';
}

export class OhderDurabilityValidatorEngine {
  analyze({ touchedFiles = [] } = {}) {
    const files = unique(Array.isArray(touchedFiles) ? touchedFiles : []);
    const touchpoints = files.flatMap(classify);
    const durabilityDelta = Math.min(6, touchpoints.reduce((total, item) => total + item.weight, 0));
    const risk = riskFor(durabilityDelta);
    const findings = touchpoints.map(item => `${item.finding}: ${item.filePath}`);
    return {
      durabilityDelta,
      risk,
      touchpoints,
      findings,
      recommendations: risk === 'low'
        ? []
        : [
          'Run replay validation for projector, snapshot, ledger, or migration changes before closing the slice.',
        ],
    };
  }
}
