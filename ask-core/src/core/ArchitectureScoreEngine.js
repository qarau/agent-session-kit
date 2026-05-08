function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(toNumber(value, 0))));
}

function gradeFor(score) {
  if (score >= 90) {
    return 'A';
  }
  if (score >= 80) {
    return 'B';
  }
  if (score >= 70) {
    return 'C';
  }
  if (score >= 60) {
    return 'D';
  }
  return 'F';
}

const CATEGORY_WEIGHTS = {
  ssotIntegrity: 20,
  replayability: 15,
  layerDiscipline: 15,
  durability: 15,
  testability: 10,
  security: 10,
  observability: 10,
  replaceability: 5,
};

function initialCategories() {
  return Object.fromEntries(Object.keys(CATEGORY_WEIGHTS).map(key => [key, 100]));
}

function applyPenalty(categories, category, points) {
  if (!Object.hasOwn(categories, category)) {
    return;
  }
  categories[category] = clampScore(categories[category] - points);
}

function categoryForViolation(violation = {}) {
  const id = normalize(violation.id);
  const metric = normalize(violation.metric);
  const combined = `${id} ${metric}`;
  if (combined.includes('ssot') || combined.includes('authority') || combined.includes('projection')) {
    return 'ssotIntegrity';
  }
  if (combined.includes('replay')) {
    return 'replayability';
  }
  if (combined.includes('layer') || combined.includes('coupling')) {
    return 'layerDiscipline';
  }
  if (combined.includes('durability') || combined.includes('migration')) {
    return 'durability';
  }
  if (combined.includes('validation') || combined.includes('test')) {
    return 'testability';
  }
  if (combined.includes('security') || combined.includes('auth')) {
    return 'security';
  }
  if (combined.includes('observability') || combined.includes('trace')) {
    return 'observability';
  }
  if (combined.includes('replaceability') || combined.includes('adapter')) {
    return 'replaceability';
  }
  return 'durability';
}

function violationPenalty(violation = {}) {
  const outcome = normalize(violation.outcome);
  const lawClass = normalize(violation.lawClass);
  if (outcome === 'block' || lawClass === 'hard') {
    return 35;
  }
  if (outcome === 'retry') {
    return 22;
  }
  return 10;
}

export class ArchitectureScoreEngine {
  score({
    entropyDelta = 0,
    couplingDelta = 0,
    replayabilityRisk = 'low',
    lawEvaluation = {},
    couplingAnalysis = null,
    durabilityAnalysis = null,
    authorityAnalysis = null,
  } = {}) {
    const categories = initialCategories();
    const violations = Array.isArray(lawEvaluation.violations) ? lawEvaluation.violations : [];

    for (const violation of violations) {
      applyPenalty(categories, categoryForViolation(violation), violationPenalty(violation));
    }

    applyPenalty(categories, 'durability', Math.min(20, toNumber(entropyDelta, 0) * 4));
    if (durabilityAnalysis?.risk === 'high') {
      applyPenalty(categories, 'durability', 20);
    } else if (durabilityAnalysis?.risk === 'medium') {
      applyPenalty(categories, 'durability', 10);
    }
    if (authorityAnalysis?.risk === 'high' || authorityAnalysis?.authorityValid === false) {
      applyPenalty(categories, 'ssotIntegrity', 25);
    }
    applyPenalty(categories, 'layerDiscipline', Math.min(20, toNumber(couplingDelta, 0) * 5));
    if (couplingAnalysis?.risk === 'high') {
      applyPenalty(categories, 'layerDiscipline', 18);
    } else if (couplingAnalysis?.risk === 'medium') {
      applyPenalty(categories, 'layerDiscipline', 8);
    }

    const replayability = normalize(replayabilityRisk);
    if (replayability === 'high') {
      applyPenalty(categories, 'replayability', 30);
    } else if (replayability === 'medium') {
      applyPenalty(categories, 'replayability', 12);
    }

    const weightedTotal = Object.entries(CATEGORY_WEIGHTS).reduce((total, [category, weight]) => {
      return total + (toNumber(categories[category], 0) * weight);
    }, 0);
    const overallScore = clampScore(weightedTotal / 100);

    return {
      overallScore,
      grade: gradeFor(overallScore),
      categories,
      weights: { ...CATEGORY_WEIGHTS },
    };
  }
}
