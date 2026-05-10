import type {
  CurrentActiveSession,
  CurrentTaskBoardSnapshot,
  CurrentTaskRecord,
} from './currentArtifacts.js';
import type {
  AskProjectionCursorState,
  AskProjectionReplayProof,
} from './projection.js';
import type { IsoTimestamp, JsonValue } from './shared.js';

export interface AskRuntimeSessionSnapshot extends CurrentActiveSession {
  sessionId: string;
  status?: string;
  updatedAt?: IsoTimestamp;
}

export interface AskRuntimeTaskBoardSnapshot extends CurrentTaskBoardSnapshot {
  tasks: Record<string, CurrentTaskRecord>;
}

export interface AskRuntimeTaskIndexedSnapshot<TTaskState extends JsonValue | Record<string, JsonValue> = Record<string, JsonValue>> {
  tasks: Record<string, TTaskState>;
  [key: string]: JsonValue | Record<string, TTaskState> | undefined;
}

export interface AskRuntimeSnapshotArtifacts {
  session: AskRuntimeSessionSnapshot;
  taskBoard: AskRuntimeTaskBoardSnapshot;
  verification: AskRuntimeTaskIndexedSnapshot;
  workflow: AskRuntimeTaskIndexedSnapshot;
  freshness: AskRuntimeTaskIndexedSnapshot;
  projectionState: AskProjectionCursorState;
  replayProof: AskProjectionReplayProof;
}

export const askRuntimeSessionSnapshotFixture = {
  sessionId: 'sess_snapshot_contract',
  actorId: 'local',
  status: 'active',
  branch: 'release-v4.0.0-sync-local',
  worktree: 'C:/repo/agent-session-kit-sync',
  updatedAt: '2026-05-10T00:00:00.000Z',
} satisfies AskRuntimeSessionSnapshot;

export const askRuntimeTaskBoardSnapshotFixture = {
  tasks: {
    'ask-snapshot-001': {
      taskId: 'ask-snapshot-001',
      status: 'created',
      title: 'Snapshot Contract Coverage',
      queueClassHint: 'integrator',
      dependencies: [],
    },
  },
} satisfies AskRuntimeTaskBoardSnapshot;

export const askRuntimeTaskIndexedSnapshotFixture = {
  tasks: {
    'ask-snapshot-001': {
      status: 'passed',
      updatedAt: '2026-05-10T00:00:00.000Z',
    },
  },
} satisfies AskRuntimeTaskIndexedSnapshot;

export const askRuntimeSnapshotArtifactsFixture = {
  session: askRuntimeSessionSnapshotFixture,
  taskBoard: askRuntimeTaskBoardSnapshotFixture,
  verification: askRuntimeTaskIndexedSnapshotFixture,
  workflow: askRuntimeTaskIndexedSnapshotFixture,
  freshness: askRuntimeTaskIndexedSnapshotFixture,
  projectionState: {
    lastAppliedSeq: 1,
    requiresReplay: false,
    reason: 'incremental',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
  replayProof: {
    schemaVersion: 1,
    mode: 'incremental',
    eventCount: 1,
    firstSeq: 1,
    lastSeq: 1,
    projectionCursor: 1,
    replayHash: 'sha256:runtime-snapshot-replay',
    snapshotHash: 'sha256:runtime-snapshot-state',
    sequenceIntegrity: {
      contiguous: true,
      monotonic: true,
      hasDuplicates: false,
      hasGaps: false,
      cursorIntegrity: 'valid',
    },
    generatedAt: '2026-05-10T00:00:01.000Z',
  },
} satisfies AskRuntimeSnapshotArtifacts;
