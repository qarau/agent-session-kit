export function createEventLedgerEnvelope(input, seq, clock = () => new Date().toISOString()) {
  return {
    seq,
    type: input.type,
    ts: clock(),
    sessionId: input.sessionId,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    actor: input.actor ?? 'local',
    payload: input.payload ?? {},
    meta: input.meta ?? {},
  };
}

export function parseEventLedgerLine(line) {
  return JSON.parse(line);
}

export function sortEventLedgerRecords(events) {
  return [...events].sort((left, right) => left.seq - right.seq);
}
