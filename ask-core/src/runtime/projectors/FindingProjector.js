function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function nowFromEvent(event) {
  return normalize(event?.ts) || new Date().toISOString();
}

function defaultStatusForDecision(decision) {
  const normalized = normalizeLower(decision);
  if (normalized === 'false-positive') {
    return 'suppressed';
  }
  if (normalized === 'exempt') {
    return 'exempted';
  }
  if (normalized === 'justified-risk') {
    return 'accepted-risk';
  }
  return 'reviewing';
}

function normalizeFinding(raw = {}, event = {}) {
  const id = normalize(raw.id || raw.findingId);
  const timestamp = nowFromEvent(event);
  return {
    id,
    status: normalize(raw.status) || 'open',
    severity: normalize(raw.severity) || 'low',
    confidence: normalize(raw.confidence) || 'low',
    metric: normalize(raw.metric),
    analyzerId: normalize(raw.analyzerId),
    lawId: normalize(raw.lawId),
    scope: normalize(raw.scope) || 'runtime',
    blocking: raw.blocking === true,
    createdAt: normalize(raw.createdAt) || timestamp,
    updatedAt: normalize(raw.updatedAt) || timestamp,
    evidenceRef: normalize(raw.evidenceRef),
    resolution: raw.resolution ?? null,
    history: Array.isArray(raw.history) ? [...raw.history] : [],
  };
}

function withFinding(state, finding) {
  return {
    ...state,
    updatedAt: finding.updatedAt,
    findings: {
      ...state.findings,
      [finding.id]: finding,
    },
  };
}

function appendHistory(finding, event, resolution = null) {
  return {
    ...finding,
    updatedAt: nowFromEvent(event),
    lastEventSeq: Number(event.seq ?? 0),
    lastEventType: normalize(event.type),
    history: [
      ...(Array.isArray(finding.history) ? finding.history : []),
      {
        eventType: normalize(event.type),
        eventSeq: Number(event.seq ?? 0),
        at: nowFromEvent(event),
        ...(resolution ? { resolution } : {}),
      },
    ],
  };
}

export class FindingProjector {
  initialState() {
    return {
      version: 1,
      updatedAt: '',
      findings: {},
    };
  }

  apply(state, event) {
    const type = normalize(event?.type);
    const payload = event?.payload || {};

    if (type === 'OhderFindingDetected') {
      const incoming = normalizeFinding(payload.finding, event);
      const current = state.findings[incoming.id];
      const finding = current
        ? {
          ...current,
          ...incoming,
          createdAt: current.createdAt || incoming.createdAt,
          resolution: current.resolution ?? incoming.resolution,
          history: current.history || [],
        }
        : incoming;
      return withFinding(state, appendHistory(finding, event));
    }

    if ([
      'OhderFindingReviewed',
      'OhderFindingExplained',
      'OhderFindingResolved',
      'OhderFindingSuppressed',
      'OhderFindingExempted',
      'OhderFindingAcceptedRisk',
      'OhderLawTuningRequested',
      'OhderAnalyzerTuningRequested',
    ].includes(type)) {
      const findingId = normalize(payload.findingId);
      if (!findingId || !state.findings[findingId]) {
        return state;
      }
      if (type === 'OhderFindingReviewed' || type === 'OhderFindingExplained') {
        return withFinding(state, appendHistory(state.findings[findingId], event));
      }
      const decision = normalize(payload.decision);
      const resolution = {
        decision,
        reason: normalize(payload.reason),
        approvedBy: normalize(payload.approvedBy),
        expiresAt: normalize(payload.expiresAt),
        taskId: normalize(payload.taskId),
        notes: normalize(payload.notes),
        resolvedAt: nowFromEvent(event),
      };
      const next = appendHistory({
        ...state.findings[findingId],
        status: normalize(payload.status) || defaultStatusForDecision(decision),
        resolution,
      }, event, resolution);
      return withFinding(state, next);
    }

    return state;
  }
}
