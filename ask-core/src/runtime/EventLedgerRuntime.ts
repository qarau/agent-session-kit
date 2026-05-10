import type {
  AskEventLedgerAppendInput,
  AskEventLedgerAppendResult,
} from '../contracts/eventLedger.js';
import type { AskRuntimeEventType } from '../contracts/events.js';
import type { JsonObject } from '../contracts/shared.js';

export type AskEventLedgerRuntimeClock = () => string;

export function createEventLedgerEnvelope<
  TPayload extends JsonObject = JsonObject,
  TMeta extends JsonObject = JsonObject,
>(
  input: AskEventLedgerAppendInput<TPayload, TMeta>,
  seq: number,
  clock: AskEventLedgerRuntimeClock = () => new Date().toISOString(),
): AskEventLedgerAppendResult<TPayload, TMeta> {
  return {
    seq,
    type: input.type,
    ts: clock(),
    sessionId: input.sessionId,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    actor: input.actor ?? 'local',
    payload: input.payload ?? ({} as TPayload),
    meta: input.meta ?? ({} as TMeta),
  };
}

export function parseEventLedgerLine(line: string): AskEventLedgerAppendResult {
  return JSON.parse(line) as AskEventLedgerAppendResult;
}

export function sortEventLedgerRecords<TEvent extends { seq: number }>(events: TEvent[]): TEvent[] {
  return [...events].sort((left, right) => left.seq - right.seq);
}

export const askEventLedgerRuntimeEnvelopeFixture = createEventLedgerEnvelope(
  {
    type: 'TaskCreated' as AskRuntimeEventType,
    sessionId: 'sess-event-ledger-runtime',
    taskId: 'task-event-ledger-runtime',
    payload: {
      title: 'Typed EventLedger runtime helper',
    },
    meta: {
      source: 'runtime-helper-fixture',
    },
  },
  1,
  () => '2026-05-10T00:00:00.000Z',
) satisfies AskEventLedgerAppendResult;

export const askEventLedgerRuntimeSortedFixture = sortEventLedgerRecords([
  {
    ...askEventLedgerRuntimeEnvelopeFixture,
    seq: 2,
  },
  {
    ...askEventLedgerRuntimeEnvelopeFixture,
    seq: 1,
  },
]) satisfies AskEventLedgerAppendResult[];
