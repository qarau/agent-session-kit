import type { AskRuntimeEvent, AskRuntimeEventType } from './events.js';
import type { IsoTimestamp, JsonObject } from './shared.js';

export interface AskEventLedgerAppendInput<TPayload extends JsonObject = JsonObject, TMeta extends JsonObject = JsonObject> {
  type: AskRuntimeEventType;
  sessionId: string;
  taskId?: string;
  actor?: string;
  payload?: TPayload;
  meta?: TMeta;
}

export interface AskEventLedgerAppendResult<TPayload extends JsonObject = JsonObject, TMeta extends JsonObject = JsonObject> {
  seq: number;
  type: AskRuntimeEventType;
  ts: IsoTimestamp;
  sessionId: string;
  taskId?: string;
  actor: string;
  payload: TPayload;
  meta: TMeta;
}

export type AskEventLedgerReadAllResult<TPayload extends JsonObject = JsonObject, TMeta extends JsonObject = JsonObject> =
  Array<AskRuntimeEvent<AskRuntimeEventType, TPayload, TMeta>>;

export interface AskEventLedgerSequencingAssumptions {
  orderedBySeq: true;
  monotonicSequence: true;
  metadataPreserved: true;
  payloadPreserved: true;
  malformedLinesThrow: true;
}

export const askEventLedgerAppendInputFixture = {
  type: 'TaskCreated',
  sessionId: 'sess-event-ledger',
  taskId: 'task-event-ledger',
  actor: 'local',
  payload: {
    title: 'Type EventLedger boundary',
  },
  meta: {
    source: 'contract-fixture',
  },
} satisfies AskEventLedgerAppendInput;

export const askEventLedgerAppendResultFixture = {
  seq: 1,
  type: 'TaskCreated',
  ts: '2026-05-10T00:00:00.000Z',
  sessionId: 'sess-event-ledger',
  taskId: 'task-event-ledger',
  actor: 'local',
  payload: {
    title: 'Type EventLedger boundary',
  },
  meta: {
    source: 'contract-fixture',
  },
} satisfies AskEventLedgerAppendResult;

export const askEventLedgerSequencingAssumptionsFixture = {
  orderedBySeq: true,
  monotonicSequence: true,
  metadataPreserved: true,
  payloadPreserved: true,
  malformedLinesThrow: true,
} satisfies AskEventLedgerSequencingAssumptions;
