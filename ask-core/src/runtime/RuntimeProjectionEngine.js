import { EventLedger } from './EventLedger.js';
import { RuntimeSnapshotStore } from './RuntimeSnapshotStore.js';
import { SessionProjector } from './projectors/SessionProjector.js';
import { TaskBoardProjector } from './projectors/TaskBoardProjector.js';
import { VerificationProjector } from './projectors/VerificationProjector.js';
import { WorkflowProjector } from './projectors/WorkflowProjector.js';
import { FreshnessProjector } from './projectors/FreshnessProjector.js';
import { IntegrationProjector } from './projectors/IntegrationProjector.js';
import { MergeReadinessProjector } from './projectors/MergeReadinessProjector.js';
import { ClaimProjector } from './projectors/ClaimProjector.js';
import { RoutingProjector } from './projectors/RoutingProjector.js';
import { ChildSessionProjector } from './projectors/ChildSessionProjector.js';
import { AgentProjector } from './projectors/AgentProjector.js';
import { QueueClassProjector } from './projectors/QueueClassProjector.js';
import { PolicyPackProjector } from './projectors/PolicyPackProjector.js';

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
    this.claimProjector = overrides.claimProjector ?? new ClaimProjector();
    this.routingProjector = overrides.routingProjector ?? new RoutingProjector();
    this.childSessionProjector = overrides.childSessionProjector ?? new ChildSessionProjector();
    this.agentProjector = overrides.agentProjector ?? new AgentProjector();
    this.queueClassProjector = overrides.queueClassProjector ?? new QueueClassProjector();
    this.policyPackProjector = overrides.policyPackProjector ?? new PolicyPackProjector();
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
    let claims = this.claimProjector.initialState();
    let routing = this.routingProjector.initialState();
    let childSessions = this.childSessionProjector.initialState();
    let agents = this.agentProjector.initialState();
    let queueClasses = this.queueClassProjector.initialState();
    let policyPacks = this.policyPackProjector.initialState();

    for (const event of sorted) {
      session = this.sessionProjector.apply(session, event);
      tasks = this.taskBoardProjector.apply(tasks, event);
      verification = this.verificationProjector.apply(verification, event);
      workflow = this.workflowProjector.apply(workflow, event);
      freshness = this.freshnessProjector.apply(freshness, event);
      integration = this.integrationProjector.apply(integration, event);
      mergeReadiness = this.mergeReadinessProjector.apply(mergeReadiness, event);
      claims = this.claimProjector.apply(claims, event);
      routing = this.routingProjector.apply(routing, event);
      childSessions = this.childSessionProjector.apply(childSessions, event);
      agents = this.agentProjector.apply(agents, event);
      queueClasses = this.queueClassProjector.apply(queueClasses, event);
      policyPacks = this.policyPackProjector.apply(policyPacks, event);
    }

    await this.snapshots.writeSession(session);
    await this.snapshots.writeTasks(tasks);
    await this.snapshots.writeVerification(verification);
    await this.snapshots.writeWorkflow(workflow);
    await this.snapshots.writeFreshness(freshness);
    await this.snapshots.writeIntegration(integration);
    await this.snapshots.writeMergeReadiness(mergeReadiness);
    await this.snapshots.writeClaims(claims);
    await this.snapshots.writeRouting(routing);
    await this.snapshots.writeChildSessions(childSessions);
    await this.snapshots.writeAgents(agents);
    await this.snapshots.writeQueueClasses(queueClasses);
    await this.snapshots.writePolicyPacks(policyPacks);

    return {
      eventsProcessed: sorted.length,
      lastSeq: sorted.length > 0 ? Number(sorted[sorted.length - 1].seq ?? 0) : 0,
    };
  }
}
