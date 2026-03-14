import { EventLedger } from './EventLedger.js';
import { RuntimeSnapshotStore } from './RuntimeSnapshotStore.js';
import { SessionProjector } from './projectors/SessionProjector.js';
import { TaskBoardProjector } from './projectors/TaskBoardProjector.js';
import { VerificationProjector } from './projectors/VerificationProjector.js';
import { WorkflowProjector } from './projectors/WorkflowProjector.js';
import { FreshnessProjector } from './projectors/FreshnessProjector.js';
import { IntegrationProjector } from './projectors/IntegrationProjector.js';
import { MergeReadinessProjector } from './projectors/MergeReadinessProjector.js';

export class RuntimeProjectionEngine {
  constructor(cwd, overrides = {}) {
    this.ledger = overrides.ledger ?? new EventLedger(cwd);
    this.snapshots = overrides.snapshots ?? new RuntimeSnapshotStore(cwd);
    this.sessionProjector = overrides.sessionProjector ?? new SessionProjector();
    this.taskBoardProjector = overrides.taskBoardProjector ?? new TaskBoardProjector();
    this.verificationProjector = overrides.verificationProjector ?? new VerificationProjector();
    this.workflowProjector = overrides.workflowProjector ?? new WorkflowProjector();
    this.freshnessProjector = overrides.freshnessProjector ?? new FreshnessProjector();
    this.integrationProjector = overrides.integrationProjector ?? new IntegrationProjector();
    this.mergeReadinessProjector = overrides.mergeReadinessProjector ?? new MergeReadinessProjector();
  }

  async replay() {
    const events = await this.ledger.readAll();
    const sorted = [...events].sort((left, right) => Number(left.seq ?? 0) - Number(right.seq ?? 0));

    let session = this.sessionProjector.initialState();
    let tasks = this.taskBoardProjector.initialState();
    let verification = this.verificationProjector.initialState();
    let workflow = this.workflowProjector.initialState();
    let freshness = this.freshnessProjector.initialState();
    let integration = this.integrationProjector.initialState();
    let mergeReadiness = this.mergeReadinessProjector.initialState();

    for (const event of sorted) {
      session = this.sessionProjector.apply(session, event);
      tasks = this.taskBoardProjector.apply(tasks, event);
      verification = this.verificationProjector.apply(verification, event);
      workflow = this.workflowProjector.apply(workflow, event);
      freshness = this.freshnessProjector.apply(freshness, event);
      integration = this.integrationProjector.apply(integration, event);
      mergeReadiness = this.mergeReadinessProjector.apply(mergeReadiness, event);
    }

    await this.snapshots.writeSession(session);
    await this.snapshots.writeTasks(tasks);
    await this.snapshots.writeVerification(verification);
    await this.snapshots.writeWorkflow(workflow);
    await this.snapshots.writeFreshness(freshness);
    await this.snapshots.writeIntegration(integration);
    await this.snapshots.writeMergeReadiness(mergeReadiness);

    return {
      eventsProcessed: sorted.length,
      lastSeq: sorted.length > 0 ? Number(sorted[sorted.length - 1].seq ?? 0) : 0,
    };
  }
}
