function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class DiffRiskEvaluator {
  evaluate(touchedFiles = []) {
    const count = Array.isArray(touchedFiles) ? touchedFiles.length : 0;
    if (count <= 2) {
      return { level: 'low', score: 0.2 };
    }
    if (count <= 8) {
      return { level: 'medium', score: 0.55 };
    }
    return { level: 'high', score: 0.85 + Math.min(0.14, toNumber(count - 8, 0) * 0.01) };
  }
}
