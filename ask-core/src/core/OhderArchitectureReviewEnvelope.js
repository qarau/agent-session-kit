function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function factsForMetric(facts = [], metrics = []) {
  const metricSet = new Set(metrics);
  return (Array.isArray(facts) ? facts : []).filter(fact => metricSet.has(normalize(fact?.metric)));
}

function attentionForFacts(facts = []) {
  return facts.some(fact => {
    const value = normalizeLower(fact?.value);
    const confidence = normalizeLower(fact?.confidence);
    return confidence === 'high' && ['invalid', 'high', 'at-risk', 'weak', 'failed', 'false'].includes(value);
  });
}

function perspective(name, metrics, semanticFacts, architectureScore = {}) {
  const facts = factsForMetric(semanticFacts, metrics);
  const status = attentionForFacts(facts) ? 'attention' : 'clear';
  return {
    name,
    status,
    summary: status === 'attention'
      ? `${name} requires review based on high-confidence OHDER facts`
      : `${name} has no high-confidence blocking fact`,
    metrics,
    evidenceCount: facts.reduce((total, fact) => total + (Array.isArray(fact?.evidence) ? fact.evidence.length : 0), 0),
    score: Number(architectureScore?.categories?.[name] ?? 0) || 0,
  };
}

export class OhderArchitectureReviewEnvelope {
  review({ semanticFacts = [], architectureScore = {} } = {}) {
    const perspectives = [
      perspective('survivability', ['ssot_integrity', 'srp_integrity', 'duplication_risk'], semanticFacts, architectureScore),
      perspective('replayability', ['event_only_sync', 'projection_authority'], semanticFacts, architectureScore),
      perspective('security', ['security_boundary'], semanticFacts, architectureScore),
      perspective('durability', ['durability_integrity'], semanticFacts, architectureScore),
      perspective('replaceability', ['replaceability_risk', 'yagni_risk'], semanticFacts, architectureScore),
    ];
    return {
      councilType: 'council-lite',
      llmCouncilUsed: false,
      replayable: true,
      status: perspectives.some(item => item.status === 'attention') ? 'attention' : 'clear',
      perspectives,
    };
  }
}
