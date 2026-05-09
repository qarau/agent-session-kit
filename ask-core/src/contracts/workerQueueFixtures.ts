import type { AskQueueAssignment } from './queues.js';
import type { AskWorkerAssignment } from './workers.js';

export const askWorkerAssignmentFixture = {
  assignmentId: 'worker-ask-ts-008-validator',
  taskId: 'ask-ts-008',
  role: 'validator',
  status: 'completed',
  workerId: 'local-codex',
  requiredCapabilities: ['typecheck', 'test'],
  claimedFiles: ['ask-core/src/contracts/workers.ts', 'ask-core/src/contracts/queues.ts'],
  startedAt: '2026-05-09T00:00:00.000Z',
  completedAt: '2026-05-09T00:00:00.000Z',
} satisfies AskWorkerAssignment;

export const askQueueAssignmentFixture = {
  taskId: 'ask-ts-008',
  queueClass: 'integrator',
  latestClass: 'integrator',
  history: [
    {
      queueClass: 'integrator',
      reason: 'Plan ingest assigned integrator queue class.',
      assignedAt: '2026-05-09T00:00:00.000Z',
    },
  ],
} satisfies AskQueueAssignment;
